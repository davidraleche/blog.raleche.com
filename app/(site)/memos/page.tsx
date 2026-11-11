import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { localizeFields } from "@/lib/localize";
import { db } from "@/lib/db";
import { getUser, canReadSummaries } from "@/lib/auth";
import { unlockSummary } from "@/app/actions/tokens";
import { UNLOCK_COST } from "@/lib/token-config";
import { BCP47 } from "@/lib/i18n/messages";

export const metadata = {
  title: "Buy Executive summaries",
  description: "A long, detailed executive summary of every interview: key ideas, numbers worth remembering, what it means for your business, a 30-60-90 day plan and the quiz answers. Unlock with tokens.",
  alternates: { canonical: "/memos" },
};

/**
 * Buy Executive summaries: every published story's executive summary, unlocked one by one with tokens
 * (the same unlock as on the story). Unlocking sends the reader to the story's summary.
 */
export default async function ExecutiveSummaries() {
  const { locale, t } = await getI18n();
  const user = await getUser();
  const subscriber = canReadSummaries(user);
  const [rawPosts, owned] = await Promise.all([
    db.post.findMany({
      where: { status: "published", publishedAt: { lte: new Date() }, executiveSummary: { not: "" } },
      select: { id: true, slug: true, title: true, dek: true, coverImage: true, executiveSummary: true },
      orderBy: { publishedAt: "desc" },
    }),
    user ? db.unlock.findMany({ where: { userId: user.id }, select: { postId: true } }) : [],
  ]);
  const posts = await localizeFields(locale, rawPosts.map(({ executiveSummary, ...p }) => ({ ...p, words: executiveSummary.split(/\s+/).length })), ["title", "dek"]);
  const ownedIds = new Set(owned.map((o) => o.postId));
  const n = (v: number) => v.toLocaleString(BCP47[locale]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <p className="kicker">{t("memoKicker")}</p>
        <h1 className="hed mx-auto mt-3 max-w-4xl text-6xl sm:text-8xl">{t("memoTitle")}</h1>
        <p className="mx-auto mt-6 max-w-2xl font-serif text-xl text-ink/70">{t("memoIntro")}</p>
        {user && (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
            {t("memoBalance", { n: n(user.tokenBalance) })} · <Link href="/store" className="text-accent hover:underline">{t("getTokens")}</Link>
          </p>
        )}
      </div>

      {posts.length ? (
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => {
            const story = `/story/${p.slug}`;
            const mine = subscriber || ownedIds.has(p.id);
            return (
              <div key={p.id} id={p.slug} className="relative flex scroll-mt-24 flex-col border-[3px] border-ink target:ring-4 target:ring-accent">
                <Link href={story}>
                  {p.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverImage} alt="" className="aspect-[1200/630] w-full border-b-[3px] border-ink object-cover" loading="lazy" />
                  ) : (
                    <div className="flex aspect-[1200/630] items-center justify-center border-b-[3px] border-ink bg-ink font-display text-5xl font-extrabold text-white/20">R</div>
                  )}
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="hed text-2xl"><Link href={story} className="hover:text-accent">{p.title}</Link></h2>
                  {p.dek && <p className="mt-2 flex-1 font-serif text-ink/70">{p.dek}</p>}
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-ink/50">{t("summaryWords", { n: n(Math.round(p.words / 100) * 100) })}</p>
                  <p className="mt-3 font-display text-3xl font-extrabold">{mine ? t("unlockedBadge") : t("memoPrice", { n: n(UNLOCK_COST) })}</p>
                  <div className="mt-3 flex flex-wrap gap-3 font-mono text-[11px] uppercase tracking-[0.15em]">
                    {mine ? (
                      <>
                        <Link href={`${story}#summary`} className="bg-ink px-4 py-2 text-white hover:bg-accent">{t("memoOpen")}</Link>
                        <a href={`${story}/summary.pdf`} className="border border-ink px-4 py-2 hover:bg-ink hover:text-white">{t("memoDownload")}</a>
                      </>
                    ) : user ? (
                      <form action={unlockSummary}>
                        <input type="hidden" name="postId" value={p.id} />
                        <input type="hidden" name="back" value={story} />
                        <button className="bg-ink px-4 py-2 uppercase text-white hover:bg-accent">{t("memoBuy", { n: n(UNLOCK_COST) })}</button>
                      </form>
                    ) : (
                      <Link href={`/signin?next=${encodeURIComponent(story)}`} className="bg-ink px-4 py-2 text-white hover:bg-accent">{t("memoSignIn")}</Link>
                    )}
                    <Link href={story} className="border border-ink px-4 py-2 hover:bg-ink hover:text-white">{t("readArticle")}</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-12 text-center font-serif text-xl text-ink/70">{t("memoNone")}</p>
      )}
    </div>
  );
}
