import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { amazonTag, amazonUrl } from "@/lib/books";
import { BookCover } from "@/components/BookCover";
import type { Messages } from "@/lib/i18n/messages";
import { AmazonButton } from "@/components/AmazonButton";
import { StoryShareVideo } from "@/components/StoryShareVideo";
import { bookMiniVideos } from "@/lib/story-videos";
import { getUser } from "@/lib/auth";
import { shareCodeFor } from "@/lib/share-rewards";
import { SHARE_REWARD } from "@/lib/tokens";

const SHARE_KEYS = ["shareVideoVertical", "shareVideoVerticalFor", "shareVideoWide", "shareVideoWideFor", "shareVideoDownload", "shareVideoShare", "shareVideoCopyCaption", "shareVideoCopyLink", "shareVideoCopied", "shareVideoOn", "shareVideoIntentTip", "shareVideoUploadTitle", "shareVideoStep1", "shareVideoStep2", "shareVideoStep3", "shareVideoOpen", "shareVideoShareFailed", "shareVideoSeeCaption", "shareVideoEarn", "shareVideoEarnSignIn", "shareVideoSignIn"] as const;

export const metadata = { title: "Books", description: "The books RALECHE guests read, recommend and wrote, with where they talked about them.", alternates: { canonical: "/books" } };

export default async function Books() {
  const { t } = await getI18n();
  const [books, tag, videos, user] = await Promise.all([
    db.book.findMany({
      where: { mentions: { some: { post: { status: "published" } } } },
      include: { mentions: { where: { post: { status: "published" } }, include: { post: { select: { slug: true, title: true } } } } },
    }),
    amazonTag(),
    bookMiniVideos(),
    getUser(),
  ]);
  // Books with a 5-second share video: the panel to post it, with the reader's share code when signed in.
  const withVideo = books.filter((b) => videos[b.slug]);
  const shareCode = withVideo.length && user ? await shareCodeFor(user.id).catch(() => null) : null;
  const shareLabels = {
    ...Object.fromEntries(SHARE_KEYS.map((k) => [k, t(k, { platform: "{platform}", n: SHARE_REWARD })])),
    shareVideoTitle: t("bookVideoTitle"),
    shareVideoBadge: t("bookVideoBadge"),
    shareVideoDek: t("bookVideoDek"),
  };
  // Most-mentioned first.
  books.sort((a, b) => b.mentions.length - a.mentions.length || a.title.localeCompare(b.title));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="kicker">{t("books")}</p>
      <h1 className="hed border-b-[3px] border-ink pb-4 text-7xl sm:text-9xl">{t("booksTitle")}</h1>
      <p className="mt-4 max-w-2xl font-serif text-xl text-ink/70">{t("booksDek")}</p>

      {withVideo.map((b) => {
        const v = videos[b.slug];
        return (
          <StoryShareVideo
            key={b.id} slug={b.slug} storyUrl={`https://raleche.com/books/${b.slug}`} videoBase={`/books/${b.slug}/video`} sectionId={`share-${b.slug}`} linkLabel="Get the book"
            formats={v.formats} speaker={v.speaker} text={v.text} credit={v.credit} hashtags={v.hashtags} labels={shareLabels} className="mt-10 max-w-3xl"
            shareCode={shareCode} signinHref={user ? undefined : `/signin?next=${encodeURIComponent(`/books#share-${b.slug}`)}`}
          />
        );
      })}

      {books.length === 0 && <p className="py-16 font-serif text-xl text-ink/60">{t("noBooks")}</p>}

      <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((b) => (
          <article key={b.id} id={b.slug} className="flex scroll-mt-24 gap-4 border-t-[3px] border-ink pt-4">
            <BookCover title={b.title} author={b.author} coverUrl={b.coverUrl} />
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="hed text-2xl leading-tight">{b.title}</h2>
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink/60">{b.author}</p>
              <ul className="mt-3 space-y-2 font-serif text-sm">
                {b.mentions.map((m) => (
                  <li key={m.id}>
                    <span className="font-bold">{m.who}</span> {t(`relation_${m.relation}` as keyof Messages)}
                    {m.note && <span className="text-ink/70">: “{m.note}”</span>}{" "}
                    <Link href={`/story/${m.post.slug}`} className="text-accent hover:underline">{t("inStory")} {m.post.title.length > 60 ? `${m.post.title.slice(0, 60)}…` : m.post.title}</Link>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-3 self-start">
                <AmazonButton href={amazonUrl(b, tag)} label={t("buyOnAmazon")} className="h-10" />
                {videos[b.slug] && <a href={`#share-${b.slug}`} className="font-mono text-[11px] font-bold uppercase tracking-widest text-accent hover:underline">▶ {t("bookVideoLink")}</a>}
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-16 border-t border-ink/15 pt-4 font-mono text-[11px] uppercase tracking-widest text-ink/50">{t("affiliateNote")}</p>
    </div>
  );
}
