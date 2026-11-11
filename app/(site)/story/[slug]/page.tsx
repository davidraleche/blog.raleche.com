import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getUser, canReadSummaries } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { storyVideo } from "@/lib/youtube";
import { hasTranscript } from "@/lib/transcript";
import { unlockSummary, deleteOwnComment, reportComment } from "@/app/actions/tokens";
import { formStamp } from "@/lib/comment-guard";
import { StoryPoll, CommentForm } from "@/components/StoryEngage";
import { StoryQuiz } from "@/components/StoryQuiz";
import { FollowButton } from "@/components/FollowButton";
import { PersonRating } from "@/components/PersonRating";
import { StoryBooks } from "@/components/StoryBooks";
import { StoryVocab } from "@/components/StoryVocab";
import { StoryShareVideo } from "@/components/StoryShareVideo";
import { storyMiniVideo } from "@/lib/story-videos";
import { shareCodeFor } from "@/lib/share-rewards";
import { ensureVocab } from "@/lib/vocab-ai";
import { amazonTag } from "@/lib/books";
import { ensureMentions } from "@/lib/mentions-ai";
import { getQuiz, ensureQuiz, nextStory } from "@/lib/quiz";
import { after } from "next/server";
import { hasUnlocked, UNLOCK_COST, PARTICIPATION_REWARD, QUIZ_REWARD, SHARE_REWARD } from "@/lib/tokens";
import { getI18n } from "@/lib/i18n/server";
import { localizePosts } from "@/lib/localize";
import { translateHtml, translateMany } from "@/lib/translate";
import { GridCard } from "@/components/Cards";
import { NewsletterForm } from "@/components/NewsletterForm";
import { AdSlot } from "@/components/Ads";
import { personSlug } from "@/lib/people";
import { ViewPing } from "./ViewPing";
import { UnlockCelebration } from "@/components/UnlockCelebration";
import { TopUpDialog } from "@/components/TopUpDialog";
import { topUpLabels, topUpPacks } from "@/lib/topup";
import { JsonLd, articleJsonLd } from "@/lib/seo";
import { tagIndex, tagSlug, splitTags } from "@/lib/tags";

type Props = { params: Promise<{ slug: string }>; searchParams?: Promise<{ unlocked?: string; topup?: string }> };

async function load(slug: string) {
  return db.post.findUnique({ where: { slug }, include: { category: true } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const raw = await load((await params).slug);
  if (!raw) return {};
  const [post] = await localizePosts((await getI18n()).locale, [raw]);
  const path = `/story/${raw.slug}`;
  const images = post.coverImage ? [{ url: post.coverImage, width: 1200, height: 630, alt: post.title }] : [];
  return {
    title: post.title,
    description: post.dek,
    keywords: raw.tags || undefined,
    authors: [{ name: raw.authorName }],
    alternates: { canonical: path, types: { "text/markdown": `/md/${raw.slug}`, "application/rss+xml": "/feed.xml" } },
    openGraph: {
      type: "article", url: path, title: post.title, description: post.dek, images,
      publishedTime: raw.publishedAt?.toISOString(), modifiedTime: raw.updatedAt.toISOString(),
      section: post.category?.name, tags: raw.tags ? raw.tags.split(",").map((t) => t.trim()) : undefined, authors: [raw.authorName],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.dek, images: images.map((i) => i.url) },
    ...(raw.status !== "published" ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function Story({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const justUnlocked = sp.unlocked === "1";
  const [raw, user, { locale, t, date: fmtDate }, tagPages] = await Promise.all([load(slug), getUser(), getI18n(), tagIndex()]);
  if (!raw || (raw.status !== "published" && user?.role !== "ADMIN")) notFound();

  const subscriber = canReadSummaries(user);
  const unlocked = !subscriber && (await hasUnlocked(user?.id, raw.id));
  const member = subscriber || unlocked;
  const locked = raw.premium && !member;
  const [voteGroups, myVote, comments, earnedRefs] = await Promise.all([
    db.pollVote.groupBy({ by: ["choice"], where: { postId: raw.id }, _count: true }),
    user ? db.pollVote.findUnique({ where: { userId_postId: { userId: user.id, postId: raw.id } }, select: { choice: true } }) : null,
    db.comment.findMany({ where: { postId: raw.id, OR: [{ hidden: false }, ...(user ? [{ userId: user.id, heldReason: { not: null } }] : [])] }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    user ? db.tokenTxn.findMany({ where: { ref: { in: [`poll:${user.id}:${raw.id}`, `comment:${user.id}:${raw.id}`] } }, select: { ref: true } }) : [],
  ]);
  // Quiz: questions (translated, answers never sent to the browser), this reader's play, and where to go next.
  const quiz = raw.status === "published" ? await getQuiz(raw.id) : null;
  if (raw.status === "published" && !quiz) after(() => ensureQuiz(raw));
  const [quizPlay, quizNextStory, quizText] = quiz
    ? await Promise.all([
        user ? db.quizAttempt.findUnique({ where: { userId_postId: { userId: user.id, postId: raw.id } } }) : null,
        nextStory(raw.id, raw.publishedAt),
        translateMany(locale, quiz.flatMap((q) => [q.q, ...q.options])),
      ])
    : [null, null, [] as string[]];
  const quizQuestions = quiz ? quiz.map((_, i) => ({ q: quizText[i * 5], options: quizText.slice(i * 5 + 1, i * 5 + 5) })) : [];
  const quizLabels = Object.fromEntries(
    (["quizTitle", "quizDek", "quizSubmit", "quizAnswerAll", "quizWin", "quizLose", "quizNext", "quizPlayed", "signInToPlay", "quizAnswersInSummary", "quizReadSummary", "watchInterview", "unlockFor", "signInToSubmit", "quizKeptNote", "quizYourAnswer", "downloadPdf"] as const).map((k) => [k, t(k, { n: "{n}", c: "{c}" })]),
  );
  // Books and people from the interview (extracted in the background the first time if missing).
  const [bookMentions, personMentions, affiliateTag] = await Promise.all([
    db.bookMention.findMany({ where: { postId: raw.id }, include: { book: true } }),
    db.personMention.findMany({ where: { postId: raw.id } }),
    amazonTag(),
  ]);
  if (raw.status === "published" && !raw.mentionsAt) after(() => ensureMentions(raw));
  // Vocabulary (terms stay in English, the point is to learn them; definitions are translated).
  const vocabRows = await db.vocabTerm.findMany({ where: { postId: raw.id }, orderBy: { createdAt: "asc" } });
  if (raw.status === "published" && !raw.vocabAt) after(() => ensureVocab(raw));
  const vocabDefs = vocabRows.length ? await translateMany(locale, vocabRows.map((v) => v.definition)) : [];
  const vocabTerms = vocabRows.map((v, i) => ({ ...v, definition: vocabDefs[i] || v.definition }));
  const vocabLabels = {
    ...Object.fromEntries((["vocabTitle", "vocabDek", "vocab_elegant", "vocab_ai", "vocab_tech", "vocab_trend"] as const).map((k) => [k, t(k)])),
    vocabCount: t("vocabCount", { n: vocabRows.length }),
  };
  const bookLabels = Object.fromEntries(
    (["onTheirShelf", "books", "buyOnAmazon", "relation_recommends", "relation_reading", "relation_influenced", "relation_wrote", "peopleTheyAdmire", "peopleTheyCriticize", "affiliateNote"] as const).map((k) => [k, t(k)]),
  );
  const follows = new Set(
    user && (raw.speaker || raw.host)
      ? (await db.follow.findMany({ where: { userId: user.id, name: { in: [raw.speaker, raw.host].filter(Boolean) as string[] } } })).map((f) => `${f.kind}:${f.name}`)
      : [],
  );
  const followLabels = { follow: t("follow"), following: t("followingBtn"), unfollow: t("unfollow") };
  // Total followers for the speaker and host, shown on their Follow buttons.
  const followerCounts = raw.speaker || raw.host
    ? await db.follow.groupBy({ by: ["kind", "name"], where: { OR: [raw.speaker && { kind: "speaker", name: raw.speaker }, raw.host && { kind: "host", name: raw.host }].filter(Boolean) as { kind: string; name: string }[] }, _count: true })
    : [];
  const followProps = (kind: string, name: string) => {
    const n = followerCounts.find((c) => c.kind === kind && c.name === name)?._count ?? 0;
    return { followers: n, labels: { ...followLabels, followers: t("followersN", { n }) } };
  };
  // Like / dislike scores for the speaker and host.
  const people = [raw.speaker && ["speaker", raw.speaker], raw.host && ["host", raw.host], ["story", raw.slug]].filter(Boolean) as [string, string][];
  const [ratingCounts, myRatings, ratingPaid] = people.length
    ? await Promise.all([
        db.personRating.groupBy({ by: ["kind", "name", "value"], where: { OR: people.map(([kind, name]) => ({ kind, name })) }, _count: true }),
        user ? db.personRating.findMany({ where: { userId: user.id, OR: people.map(([kind, name]) => ({ kind, name })) } }) : [],
        user ? db.tokenTxn.findMany({ where: { ref: { in: people.map(([kind, name]) => `rating:${user.id}:${kind}:${name}`) } }, select: { ref: true } }) : [],
      ])
    : [[], [], []];
  const ratingFor = (kind: string, name: string) => ({
    up: ratingCounts.find((r) => r.kind === kind && r.name === name && r.value === 1)?._count ?? 0,
    down: ratingCounts.find((r) => r.kind === kind && r.name === name && r.value === -1)?._count ?? 0,
    mine: myRatings.find((r) => r.kind === kind && r.name === name)?.value ?? 0,
    earned: ratingPaid.some((r) => r.ref === `rating:${user?.id}:${kind}:${name}`),
  });
  const ratingLabels = { like: t("likePerson"), dislike: t("dislikePerson"), earn: t("rateEarn", { n: PARTICIPATION_REWARD }), plus: t("earnedTokens", { n: "{n}" }) };
  const storyRatingLabels = { ...ratingLabels, like: t("likeStory"), dislike: t("dislikeStory") };
  const reportedIds = new Set(user ? (await db.commentReport.findMany({ where: { userId: user.id, comment: { postId: raw.id } }, select: { commentId: true } })).map((r) => r.commentId) : []);
  const voteCounts = Object.fromEntries(voteGroups.map((g) => [g.choice, g._count]));
  const earnedPoll = earnedRefs.some((r) => r.ref?.startsWith("poll:"));
  const earnedComment = earnedRefs.some((r) => r.ref?.startsWith("comment:"));
  const engageLabels = Object.fromEntries(
    (["pollTitle", "poll_great", "poll_average", "poll_not_great", "pollEarn", "pollThanks", "votesN", "earnedTokens", "signInToVote", "commentsEarn", "commentPlaceholder", "postComment", "commentHeld", "commentRules", "pollCongrats", "pollTapToVote"] as const).map((k) => [k, t(k, { n: "{n}" })]),
  );
  // The story's mini video (8-second clip) and its share panel, shown at the end of the story.
  const miniVideo = raw.status === "published" ? await storyMiniVideo(raw.slug) : null;
  // Signed-in readers share links with their code (&by=…) and earn tokens for each new reader they bring.
  const shareCode = miniVideo && user ? await shareCodeFor(user.id).catch(() => null) : null;
  const shareVideoLabels = Object.fromEntries(
    (["shareVideoTitle", "shareVideoBadge", "shareVideoDek", "shareVideoVertical", "shareVideoVerticalFor", "shareVideoWide", "shareVideoWideFor", "shareVideoDownload", "shareVideoShare", "shareVideoCopyCaption", "shareVideoCopyLink", "shareVideoCopied", "shareVideoOn", "shareVideoIntentTip", "shareVideoUploadTitle", "shareVideoStep1", "shareVideoStep2", "shareVideoStep3", "shareVideoOpen", "shareVideoShareFailed", "shareVideoSeeCaption", "shareVideoEarn", "shareVideoEarnSignIn", "shareVideoSignIn"] as const).map((k) => [k, t(k, { platform: "{platform}", n: SHARE_REWARD })]),
  );
  const { videoId, body: fullBody } = storyVideo(raw.body);
  const transcriptAvailable = raw.status === "published" && (await hasTranscript(raw.slug));
  const body = locked ? fullBody.split(/\n\n/).slice(0, 3).join("\n\n") : fullBody;
  const rawRelated = await db.post.findMany({
    where: { status: "published", id: { not: raw.id }, categoryId: raw.categoryId },
    include: { category: true }, orderBy: { publishedAt: "desc" }, take: 3,
  });
  // Only translate the summary for readers who can see it.
  // Split the article right after its "The short version" section; the reader blocks go there.
  const split = splitAfterShortVersion(body);
  const [[post, ...related], bodyHtml, restHtml, summaryHtml] = await Promise.all([
    localizePosts(locale, [raw, ...rawRelated]),
    translateHtml(locale, renderMarkdown(split ? split[0] : body)),
    split ? translateHtml(locale, renderMarkdown(split[1])) : Promise.resolve(""),
    member && raw.executiveSummary ? translateHtml(locale, renderMarkdown(raw.executiveSummary)) : Promise.resolve(""),
  ]);

  const readerBlocks = (
    <>
        {raw.status === "published" && (
          <div id="rate" className="mb-10 flex flex-wrap items-center gap-3 border-y-2 border-ink py-4">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink/60">{t("rateThisStory")}</span>
            <PersonRating kind="story" name={raw.slug} {...ratingFor("story", raw.slug)} signedIn={!!user} back={`/story/${raw.slug}#rate`} reward={PARTICIPATION_REWARD} labels={storyRatingLabels} size="md" />
          </div>
        )}
        <StoryBooks books={bookMentions} people={personMentions} tag={affiliateTag} labels={bookLabels} className="mb-10" />
        <StoryVocab terms={vocabTerms} labels={vocabLabels} className="mb-10" />
        {user && !member && raw.executiveSummary && (sp.topup === "quiz" || sp.topup === "summary") && (
          <TopUpDialog packs={topUpPacks()} balance={user.tokenBalance} cost={UNLOCK_COST} next={`/story/${raw.slug}`} then={`unlock:${raw.id}:${sp.topup}`} labels={topUpLabels(t)} />
        )}
        {justUnlocked && unlocked && (() => { const fromQuiz = !!quiz && !!quizPlay && quizPlay.correct < quiz.length; return <UnlockCelebration title={t("unlockCelebrateTitle")} detail={t(fromQuiz ? "unlockCelebrateQuiz" : "unlockCelebrateDetail")} target={fromQuiz ? "quiz" : "summary"} />; })()}
        <ExecutiveSummary hasSummary={!!raw.executiveSummary} html={summaryHtml} member={member} unlocked={unlocked} signedIn={!!user} balance={user?.tokenBalance ?? 0} postId={raw.id} back={`/story/${raw.slug}`} t={t} />
        {quiz && raw.status === "published" && (
          <StoryQuiz
            className="mb-10"
            postId={raw.id} questions={quizQuestions} signedIn={!!user} reward={QUIZ_REWARD}
            played={quizPlay ? { correct: quizPlay.correct, answers: quizPlay.correct === quiz.length || member ? quiz.map((q) => q.answer) : [], picks: quizPlay.picks } : null}
            summary={raw.executiveSummary ? { unlocked: member, cost: UNLOCK_COST, back: `/story/${raw.slug}`, pdf: `/story/${raw.slug}/summary.pdf` } : null}
            videoUrl={raw.body.match(/https:\/\/www\.youtube\.com\/watch\?v=[\w-]+/)?.[0] ?? null}
            signinHref={`/signin?next=${encodeURIComponent(`/story/${raw.slug}#quiz`)}`} next={quizNextStory} labels={quizLabels}
          />
        )}
    </>
  );

  return (
    <article>
      <ViewPing postId={post.id} />
      {raw.status === "published" && <JsonLd data={articleJsonLd(raw)} />}
      <header id="story" className="mx-auto max-w-4xl scroll-mt-4 px-4 pt-10 text-center">
        {post.category && <Link href={`/category/${post.category.slug}`} className="kicker hover:underline">{post.category.name}</Link>}
        {post.status !== "published" && <span className="ml-3 bg-terminal-amber px-2 py-0.5 font-mono text-[10px] uppercase">{post.status}</span>}
        <h1 className="hed mt-4 text-5xl sm:text-7xl">{post.title}</h1>
        {post.dek && <p className="mx-auto mt-6 max-w-3xl font-serif text-xl text-ink/75 sm:text-2xl">{post.dek}</p>}
        <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-ink/60">
          {t("by")} <span className="text-ink">{post.authorName}</span> · {fmtDate(post.publishedAt)} · {t("minRead", { n: post.readMinutes })}
        </p>
        {(post.speaker || post.host) && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-2 font-mono text-[11px] uppercase tracking-widest text-ink/60">
            {post.speaker && <Link href={`/speakers#${personSlug(post.speaker)}`} className="text-accent hover:underline">{t("withSpeaker", { name: post.speaker })}</Link>}
            {raw.speaker && <span className="ml-2 inline-flex items-center gap-1 align-middle"><FollowButton kind="speaker" name={raw.speaker} following={follows.has(`speaker:${raw.speaker}`)} signedIn={!!user} back={`/story/${raw.slug}`} {...followProps("speaker", raw.speaker)} /><PersonRating kind="speaker" name={raw.speaker} {...ratingFor("speaker", raw.speaker)} signedIn={!!user} back={`/story/${raw.slug}`} reward={PARTICIPATION_REWARD} labels={ratingLabels} /></span>}
            {post.speaker && post.host && " · "}
            {post.host && <Link href={`/hosts#${personSlug(post.host)}`} className="hover:underline">{t("hostedBy", { name: post.host })}{post.show ? `, ${post.show}` : ""}</Link>}
            {raw.host && <span className="ml-2 inline-flex items-center gap-1 align-middle"><FollowButton kind="host" name={raw.host} following={follows.has(`host:${raw.host}`)} signedIn={!!user} back={`/story/${raw.slug}`} {...followProps("host", raw.host)} /><PersonRating kind="host" name={raw.host} {...ratingFor("host", raw.host)} signedIn={!!user} back={`/story/${raw.slug}`} reward={PARTICIPATION_REWARD} labels={ratingLabels} /></span>}
          </div>
        )}
        {locale !== "en" && <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-ink/40">{t("machineTranslated")}</p>}
      </header>

      {post.coverImage && (
        <figure className="mx-auto mt-10 max-w-3xl px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImage} alt={post.title} width={1200} height={630} fetchPriority="high" className="w-full" />
        </figure>
      )}

      <div className="mx-auto mt-10 max-w-3xl px-4">
        {!split && readerBlocks}
        <AdSlot name="articleTop" />

        {videoId && (
          <figure className="mb-10">
            <div className="relative aspect-video w-full overflow-hidden bg-ink">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
                title={post.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
            <figcaption className="mt-2 font-mono text-[11px] uppercase tracking-widest text-ink/50">{t("watchInterview")}</figcaption>
          </figure>
        )}
        <div className="prose-article" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        {split && (
          <>
            <div className="mt-10">{readerBlocks}</div>
            <div className="prose-article" dangerouslySetInnerHTML={{ __html: restHtml }} />
          </>
        )}

        {locked && (
          <div className="relative -mt-24 bg-gradient-to-t from-white via-white to-transparent pt-24 text-center">
            <p className="hed text-3xl">{t("storyLocked")}</p>
            {user ? (
              <form action={unlockSummary} className="mt-4">
                <input type="hidden" name="postId" value={raw.id} /><input type="hidden" name="back" value={`/story/${raw.slug}`} />
                <button className="btn bg-terminal-amber text-ink hover:bg-ink hover:text-white">{t("unlockFor", { n: UNLOCK_COST })}</button>
              </form>
            ) : (
              <Link href={`/signin?next=${encodeURIComponent(`/story/${raw.slug}`)}`} className="btn bg-terminal-amber text-ink hover:bg-ink hover:text-white mt-4">{t("unlockFor", { n: UNLOCK_COST })}</Link>
            )}
            {user && <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-ink/60">{t("youHaveTokens", { n: user.tokenBalance })} · <Link href="/store" className="text-accent underline">{t("getTokens")}</Link></p>}
          </div>
        )}

        {transcriptAvailable && (
          <section id="transcript" className="mt-12 border-[3px] border-ink p-6">
            <p className="kicker">{t("transcriptTitle")}</p>
            <p className="mt-2 font-serif text-lg text-ink/80">{t("transcriptBlurb")}</p>
            <Link
              href={user ? `/story/${raw.slug}/transcript` : `/signin?next=${encodeURIComponent(`/story/${raw.slug}/transcript`)}`}
              className="btn-dark mt-4"
            >
              {user ? t("transcriptOpen") : t("transcriptSignIn")}
            </Link>
          </section>
        )}

        {miniVideo && (
          <StoryShareVideo
            slug={raw.slug} storyUrl={`https://raleche.com/story/${raw.slug}`} formats={miniVideo.formats} speaker={miniVideo.speaker}
            text={miniVideo.text} credit={miniVideo.credit} hashtags={miniVideo.hashtags} labels={shareVideoLabels}
            shareCode={shareCode} signinHref={user ? undefined : `/signin?next=${encodeURIComponent(`/story/${raw.slug}#share-video`)}`}
          />
        )}

        <AdSlot name="articleEnd" />

        {post.tags && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-ink/15 pt-6">
            {splitTags(post.tags).map((t) =>
              tagPages.has(tagSlug(t)) ? (
                <Link key={t} href={`/tag/${tagSlug(t)}`} className="border border-ink/30 px-3 py-1 font-mono text-[11px] uppercase tracking-widest hover:bg-ink hover:text-white">{t}</Link>
              ) : (
                <span key={t} className="border border-ink/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-ink/60">{t}</span>
              ),
            )}
          </div>
        )}
        {post.sourceUrl && (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-ink/50">
            {t("originallyPublished")} <a href={post.sourceUrl} className="underline">Tech Team Strategy</a>
          </p>
        )}

        {raw.status === "published" && (
          <>
            <StoryPoll postId={raw.id} signedIn={!!user} mine={myVote?.choice ?? null} counts={voteCounts} earned={earnedPoll} reward={PARTICIPATION_REWARD} signinHref={`/signin?next=${encodeURIComponent(`/story/${raw.slug}#poll`)}`} labels={engageLabels} />
            <section id="comments" className="mt-12">
              <h2 className="hed rule pt-3 text-3xl">{t("commentsTitle")} {comments.length > 0 && <span className="font-mono text-base text-ink/50">({comments.length})</span>}</h2>
              {user ? (
                <CommentForm postId={raw.id} earned={earnedComment} reward={PARTICIPATION_REWARD} stamp={formStamp()} labels={engageLabels} />
              ) : (
                <p className="mt-4 font-serif text-ink/70">
                  <Link href={`/signin?next=${encodeURIComponent(`/story/${raw.slug}#comments`)}`} className="btn-dark">{t("signInToComment")}</Link>
                  <span className="ml-3 font-mono text-[11px] uppercase tracking-widest">{t("commentsEarn", { n: PARTICIPATION_REWARD })}</span>
                </p>
              )}
              <ul className="mt-8 space-y-6">
                {comments.length === 0 && <li className="font-serif text-ink/60">{t("noComments")}</li>}
                {comments.map((c) => (
                  <li key={c.id} className="border-l-[3px] border-ink pl-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 font-mono text-[11px] uppercase tracking-widest">
                      <span className="font-bold">{c.user.name?.trim() || "Reader"}</span>
                      <span className="text-ink/50">{fmtDate(c.createdAt)}</span>
                      {c.hidden && <span className="bg-terminal-amber px-1.5 text-ink">{t("commentPendingBadge")}</span>}
                      {(user?.id === c.userId || user?.role === "ADMIN") && (
                        <form action={deleteOwnComment} className="inline"><input type="hidden" name="id" value={c.id} /><button className="text-accent hover:underline">{t("deleteComment")}</button></form>
                      )}
                      {user && user.id !== c.userId && (
                        reportedIds.has(c.id)
                          ? <span className="text-ink/40">{t("reported")}</span>
                          : <form action={reportComment} className="inline"><input type="hidden" name="id" value={c.id} /><button className="text-ink/40 hover:text-accent hover:underline">{t("reportComment")}</button></form>
                      )}
                    </div>
                    <p className={`mt-1 whitespace-pre-line break-words font-serif text-lg ${c.hidden ? "text-ink/50" : ""}`}>{c.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <div className="mt-12 border-y-[3px] border-ink py-8">
          <p className="hed text-3xl">{t("getTheBriefing")}</p>
          <p className="mb-4 mt-1 font-serif text-ink/70">{t("briefingInbox")}</p>
          <NewsletterForm source={`story:${post.slug}`} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-4">
          <h2 className="hed rule pt-3 text-3xl">{t("more", { name: post.category?.name ?? "" })}</h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">{related.map((p) => <GridCard key={p.id} post={p} />)}</div>
        </section>
      )}
    </article>
  );
}

function ExecutiveSummary({ hasSummary, html, member, unlocked, signedIn, balance, postId, back, t }: { hasSummary: boolean; html: string; member: boolean; unlocked: boolean; signedIn: boolean; balance: number; postId: string; back: string; t: Awaited<ReturnType<typeof getI18n>>["t"] }) {
  if (!hasSummary) return null;
  return (
    <aside id="summary" className="mb-10 scroll-mt-24 border-[3px] border-ink">
      <div className="flex items-center justify-between bg-ink px-5 py-3 text-white">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{t("executiveSummary")}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-terminal-amber">{unlocked ? t("unlockedBadge") : member ? t("unlockedBadge") : t("unlockFor", { n: UNLOCK_COST })}</span>
      </div>
      {member ? (
        <>
          <div className="prose-article prose-base px-5 py-4 prose-h2:text-xl" dangerouslySetInnerHTML={{ __html: html }} />
          <div className="border-t border-ink/10 px-5 py-3">
            <a href={`${back}/summary.pdf`} className="btn-dark inline-flex items-center gap-2">⬇ {t("downloadPdf")}</a>
          </div>
        </>
      ) : (
        <div className="relative px-5 py-5">
          <div aria-hidden className="pointer-events-none select-none space-y-3 blur-[5px]">
            {[90, 75, 85, 60, 80].map((w, i) => <div key={i} className="h-3 bg-ink/40" style={{ width: `${w}%` }} />)}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 px-4 text-center">
            <p className="font-display text-2xl font-bold uppercase">{t("takeaways")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {signedIn ? (
                <form action={unlockSummary}>
                  <input type="hidden" name="postId" value={postId} /><input type="hidden" name="back" value={back} />
                  <button className="btn bg-terminal-amber text-ink hover:bg-ink hover:text-white">{t("unlockFor", { n: UNLOCK_COST })}</button>
                </form>
              ) : (
                <Link href={`/signin?next=${encodeURIComponent(back)}`} className="btn bg-terminal-amber text-ink hover:bg-ink hover:text-white">{t("unlockFor", { n: UNLOCK_COST })}</Link>
              )}
            </div>
            {signedIn && (
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink/70">
                {t("youHaveTokens", { n: balance })}{balance < UNLOCK_COST && <> · <Link href={`/store?next=${encodeURIComponent(back)}`} className="text-accent underline">{t("getTokens")}</Link></>}
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

/** Cut the article markdown after its "## The short version" section (before the next "## " heading). Null when there is none. */
function splitAfterShortVersion(md: string): [string, string] | null {
  const head = /^##\s+the short version\s*$/im.exec(md);
  if (!head) return null;
  const after = head.index + head[0].length;
  const next = /^##\s/m.exec(md.slice(after));
  if (!next) return null;
  return [md.slice(0, after + next.index), md.slice(after + next.index)];
}
