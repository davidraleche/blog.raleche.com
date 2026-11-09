import Link from "next/link";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { localizePosts } from "@/lib/localize";
import { QUIZ_REWARD } from "@/lib/tokens";
import { QuoteWheel, type SpeakerQuote } from "@/components/QuoteWheel";
import { translateMany } from "@/lib/translate";

export const metadata = { title: "Play", description: "Two-question quizzes on every RALECHE story. Get both right to win tokens.", alternates: { canonical: "/play" } };

export default async function Play() {
  const [{ locale, t }, user] = await Promise.all([getI18n(), getUser()]);
  const raw = await db.post.findMany({
    where: { status: "published", publishedAt: { lte: new Date() }, quiz: { isNot: null } },
    include: { category: true },
    orderBy: { publishedAt: "desc" },
  });
  const [posts, attempts] = await Promise.all([
    localizePosts(locale, raw),
    user ? db.quizAttempt.findMany({ where: { userId: user.id }, select: { postId: true, correct: true, earned: true } }) : [],
  ]);
  const played = new Map(attempts.map((a) => [a.postId, a]));
  const won = attempts.filter((a) => a.earned > 0).length;
  // Unplayed quizzes first, newest first within each group.
  const ordered = [...posts].sort((a, b) => Number(played.has(a.id)) - Number(played.has(b.id)));

  // Quotes for the wheel: complete sentences quoted in each story with a speaker.
  const quoteSource = await db.post.findMany({ where: { status: "published", speaker: { not: null } }, select: { slug: true, title: true, speaker: true, body: true } });
  const rawQuotes: SpeakerQuote[] = quoteSource.flatMap((p) =>
    [...p.body.matchAll(/_?[\u201c"]([^"\u201d\n]{50,220})[\u201d"]_?/g)]
      .map((m) => m[1].replace(/^[_\s]+|[_\s]+$/g, ""))
      .filter((q) => /^[A-Z]/.test(q) && /[.!?]$/.test(q))
      .map((text) => ({ text, speaker: p.speaker!, slug: p.slug, title: p.title })),
  );
  const quoteText = await translateMany(locale, rawQuotes.map((q) => q.text));
  const quotes = rawQuotes.map((q, i) => ({ ...q, text: quoteText[i] ?? q.text }));
  const wheelLabels = { title: t("quoteWheelTitle"), dek: t("quoteWheelDek"), spin: t("spin"), spinAgain: t("spinAgain"), quote: t("quoteWord"), miss: t("tryAgain"), missDek: t("quoteMissDek"), readStory: t("readFullStory") };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="kicker">{t("play")}</p>
      <h1 className="hed border-b-[3px] border-ink pb-4 text-7xl sm:text-9xl">{t("playTitle")}</h1>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
        <p className="max-w-2xl font-serif text-xl text-ink/70">{t("playDek", { n: QUIZ_REWARD })}</p>
        {user && <p className="font-mono text-[11px] uppercase tracking-widest">{t("playStats", { w: won, n: posts.length, p: attempts.length })}</p>}
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((p, i) => {
          const a = played.get(p.id);
          const card = (
            <Link key={p.id} href={`/story/${p.slug}#quiz`} className={`group flex flex-col border-[3px] border-ink transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#e1251b] ${a ? "opacity-70" : ""}`}>
              {p.coverImage && (
                <div className="relative aspect-[40/21] w-full overflow-hidden border-b-[3px] border-ink">
                  <img src={p.coverImage} alt="" loading="lazy" width={1200} height={630} className="h-full w-full object-cover" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                {p.category && <span className="kicker">{p.category.name}</span>}
                <span className="hed mt-1 text-2xl group-hover:text-accent">{p.title}</span>
                <span className="mt-auto pt-4">
                  {!a ? (
                    <span className="inline-block bg-accent px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-white">{t("playNow")} · +{QUIZ_REWARD}</span>
                  ) : a.earned ? (
                    <span className="inline-block bg-terminal-amber px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest">{t("quizWonBadge", { n: a.earned })}</span>
                  ) : (
                    <span className="inline-block border border-ink/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-ink/60">{t("quizMissedBadge", { c: a.correct })}</span>
                  )}
                </span>
              </div>
            </Link>
          );
          return i === 2 || (i === ordered.length - 1 && ordered.length < 3) ? [card, <QuoteWheel key="quote-wheel" quotes={quotes} labels={wheelLabels} />] : card;
        })}
      </div>
    </div>
  );
}
