import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getUser, canReadSummaries } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { unlockSummary, deleteOwnComment } from "@/app/actions/tokens";
import { StoryPoll, CommentForm } from "@/components/StoryEngage";
import { StoryQuiz } from "@/components/StoryQuiz";
import { FollowButton } from "@/components/FollowButton";
import { getQuiz, ensureQuiz, nextStory } from "@/lib/quiz";
import { after } from "next/server";
import { hasUnlocked, UNLOCK_COST, PARTICIPATION_REWARD, QUIZ_REWARD } from "@/lib/tokens";
import { getI18n } from "@/lib/i18n/server";
import { localizePosts } from "@/lib/localize";
import { translateHtml, translateMany } from "@/lib/translate";
import { GridCard } from "@/components/Cards";
import { NewsletterForm } from "@/components/NewsletterForm";
import { AdSlot } from "@/components/Ads";
import { personSlug } from "@/lib/people";
import { ViewPing } from "./ViewPing";
import { JsonLd, articleJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

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

export default async function Story({ params }: Props) {
  const { slug } = await params;
  const [raw, user, { locale, t, date: fmtDate }] = await Promise.all([load(slug), getUser(), getI18n()]);
  if (!raw || (raw.status !== "published" && user?.role !== "ADMIN")) notFound();

  const subscriber = canReadSummaries(user);
  const unlocked = !subscriber && (await hasUnlocked(user?.id, raw.id));
  const member = subscriber || unlocked;
  const locked = raw.premium && !member;
  const [voteGroups, myVote, comments, earnedRefs] = await Promise.all([
    db.pollVote.groupBy({ by: ["choice"], where: { postId: raw.id }, _count: true }),
    user ? db.pollVote.findUnique({ where: { userId_postId: { userId: user.id, postId: raw.id } }, select: { choice: true } }) : null,
    db.comment.findMany({ where: { postId: raw.id, hidden: false }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
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
    (["quizTitle", "quizDek", "quizSubmit", "quizAnswerAll", "quizWin", "quizLose", "quizNext", "quizPlayed", "signInToPlay"] as const).map((k) => [k, t(k, { n: "{n}", c: "{c}" })]),
  );
  const follows = new Set(
    user && (raw.speaker || raw.host)
      ? (await db.follow.findMany({ where: { userId: user.id, name: { in: [raw.speaker, raw.host].filter(Boolean) as string[] } } })).map((f) => `${f.kind}:${f.name}`)
      : [],
  );
  const followLabels = { follow: t("follow"), following: t("followingBtn"), unfollow: t("unfollow") };
  const voteCounts = Object.fromEntries(voteGroups.map((g) => [g.choice, g._count]));
  const earnedPoll = earnedRefs.some((r) => r.ref?.startsWith("poll:"));
  const earnedComment = earnedRefs.some((r) => r.ref?.startsWith("comment:"));
  const engageLabels = Object.fromEntries(
    (["pollTitle", "poll_great", "poll_average", "poll_not_great", "pollEarn", "pollThanks", "votesN", "earnedTokens", "signInToVote", "commentsEarn", "commentPlaceholder", "postComment"] as const).map((k) => [k, t(k, { n: "{n}" })]),
  );
  const body = locked ? raw.body.split(/\n\n/).slice(0, 3).join("\n\n") : raw.body;
  const rawRelated = await db.post.findMany({
    where: { status: "published", id: { not: raw.id }, categoryId: raw.categoryId },
    include: { category: true }, orderBy: { publishedAt: "desc" }, take: 3,
  });
  // Only translate the summary for readers who can see it.
  const [[post, ...related], bodyHtml, summaryHtml] = await Promise.all([
    localizePosts(locale, [raw, ...rawRelated]),
    translateHtml(locale, renderMarkdown(body)),
    member && raw.executiveSummary ? translateHtml(locale, renderMarkdown(raw.executiveSummary)) : Promise.resolve(""),
  ]);

  return (
    <article>
      <ViewPing postId={post.id} />
      {raw.status === "published" && <JsonLd data={articleJsonLd(raw)} />}
      <header className="mx-auto max-w-4xl px-4 pt-10 text-center">
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
            {raw.speaker && <span className="ml-2 align-middle"><FollowButton kind="speaker" name={raw.speaker} following={follows.has(`speaker:${raw.speaker}`)} signedIn={!!user} back={`/story/${raw.slug}`} labels={followLabels} /></span>}
            {post.speaker && post.host && " · "}
            {post.host && <Link href={`/hosts#${personSlug(post.host)}`} className="hover:underline">{t("hostedBy", { name: post.host })}{post.show ? `, ${post.show}` : ""}</Link>}
            {raw.host && <span className="ml-2 align-middle"><FollowButton kind="host" name={raw.host} following={follows.has(`host:${raw.host}`)} signedIn={!!user} back={`/story/${raw.slug}`} labels={followLabels} /></span>}
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
        <ExecutiveSummary hasSummary={!!raw.executiveSummary} html={summaryHtml} member={member} unlocked={unlocked} signedIn={!!user} balance={user?.tokenBalance ?? 0} postId={raw.id} back={`/story/${raw.slug}`} t={t} />
        <AdSlot name="articleTop" />

        <div className="prose-article" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

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

        <AdSlot name="articleEnd" />

        {post.tags && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-ink/15 pt-6">
            {post.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
              <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="border border-ink/30 px-3 py-1 font-mono text-[11px] uppercase tracking-widest hover:bg-ink hover:text-white">{t}</Link>
            ))}
          </div>
        )}
        {post.sourceUrl && (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-ink/50">
            {t("originallyPublished")} <a href={post.sourceUrl} className="underline">Tech Team Strategy</a>
          </p>
        )}

        {raw.status === "published" && (
          <>
            {quiz && (
              <StoryQuiz
                postId={raw.id} questions={quizQuestions} signedIn={!!user} reward={QUIZ_REWARD}
                played={quizPlay ? { correct: quizPlay.correct, answers: quiz.map((q) => q.answer) } : null}
                signinHref={`/signin?next=${encodeURIComponent(`/story/${raw.slug}#quiz`)}`} next={quizNextStory} labels={quizLabels}
              />
            )}
            <StoryPoll postId={raw.id} signedIn={!!user} mine={myVote?.choice ?? null} counts={voteCounts} earned={earnedPoll} reward={PARTICIPATION_REWARD} signinHref={`/signin?next=${encodeURIComponent(`/story/${raw.slug}#poll`)}`} labels={engageLabels} />
            <section id="comments" className="mt-12">
              <h2 className="hed rule pt-3 text-3xl">{t("commentsTitle")} {comments.length > 0 && <span className="font-mono text-base text-ink/50">({comments.length})</span>}</h2>
              {user ? (
                <CommentForm postId={raw.id} earned={earnedComment} reward={PARTICIPATION_REWARD} labels={engageLabels} />
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
                      <span className="font-bold">{c.user.name || c.user.email?.split("@")[0] || "Reader"}</span>
                      <span className="text-ink/50">{fmtDate(c.createdAt)}</span>
                      {(user?.id === c.userId || user?.role === "ADMIN") && (
                        <form action={deleteOwnComment} className="inline"><input type="hidden" name="id" value={c.id} /><button className="text-accent hover:underline">{t("deleteComment")}</button></form>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-line font-serif text-lg">{c.body}</p>
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
    <aside className="mb-10 border-[3px] border-ink">
      <div className="flex items-center justify-between bg-ink px-5 py-3 text-white">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{t("executiveSummary")}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-terminal-amber">{unlocked ? t("unlockedBadge") : member ? t("unlockedBadge") : t("unlockFor", { n: UNLOCK_COST })}</span>
      </div>
      {member ? (
        <div className="prose-article prose-base px-5 py-4 prose-h2:text-xl" dangerouslySetInnerHTML={{ __html: html }} />
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
