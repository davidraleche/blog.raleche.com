import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { localizePosts } from "@/lib/localize";
import { storyVideo } from "@/lib/youtube";
import { loadTranscript, toSeconds } from "@/lib/transcript";

type Props = { params: Promise<{ slug: string }> };

// Readers only: transcripts stay out of search results.
export const metadata = { title: "Transcript", robots: { index: false, follow: false } };

export default async function Transcript({ params }: Props) {
  const { slug } = await params;
  const raw = await db.post.findUnique({ where: { slug }, include: { category: true } });
  if (!raw || raw.status !== "published") notFound();
  await requireUser(`/story/${slug}/transcript`);
  const { locale, t } = await getI18n();
  const [[post], segments] = await Promise.all([localizePosts(locale, [raw]), loadTranscript(slug)]);
  if (!segments) notFound();
  const { videoId } = storyVideo(raw.body);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href={`/story/${slug}`} className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent hover:underline">← {t("transcriptBack")}</Link>
      <p className="kicker mt-8">{t("transcriptOf")}</p>
      <h1 className="hed mt-3 text-4xl sm:text-5xl">{post.title}</h1>
      <p className="mt-4 font-serif text-sm text-ink/60">
        {t("transcriptNote")}
        {locale !== "en" && <> {t("transcriptEnglishOnly")}</>}
        {videoId && <> {t("transcriptJump")}</>}
      </p>

      <div lang="en" className="mt-8 border-t-[3px] border-ink pt-6 font-serif text-lg leading-relaxed">
        {segments.map(([who, at, text], i) => (
          <p key={i} className="mb-4">
            {videoId ? (
              <a href={`https://www.youtube.com/watch?v=${videoId}&t=${toSeconds(at)}s`} target="_blank" rel="noopener noreferrer" className="mr-2 font-mono text-xs tabular-nums text-ink/50 hover:text-accent">{at}</a>
            ) : (
              <span className="mr-2 font-mono text-xs tabular-nums text-ink/50">{at}</span>
            )}
            {who && <b className="font-sans">{who}: </b>}
            {text}
          </p>
        ))}
      </div>

      <Link href={`/story/${slug}`} className="btn-dark mt-8">{t("transcriptBack")}</Link>
    </div>
  );
}
