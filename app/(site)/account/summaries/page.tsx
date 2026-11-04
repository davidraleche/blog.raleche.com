import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, canReadSummaries } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { getI18n } from "@/lib/i18n/server";
import { localizePosts } from "@/lib/localize";
import { translateHtml } from "@/lib/translate";

export const metadata = { title: "Executive summaries" };

export default async function Summaries({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const user = await requireUser("/account/summaries");
  const { locale, t, date: fmtDate } = await getI18n();
  const member = canReadSummaries(user);
  const term = q.trim();
  const raw = await db.post.findMany({
    where: { status: "published", publishedAt: { lte: new Date() }, executiveSummary: { not: "" } },
    include: { category: true },
    orderBy: { publishedAt: "desc" },
  });
  // Translate titles (and summaries for members), then search both the English and the translated text.
  const [localized, summaries] = await Promise.all([
    localizePosts(locale, raw),
    member ? Promise.all(raw.map((p) => translateHtml(locale, renderMarkdown(p.executiveSummary)))) : Promise.resolve(raw.map(() => "")),
  ]);
  const needle = term.toLowerCase();
  const posts = localized
    .map((p, i) => ({ ...p, summaryHtml: summaries[i] }))
    .filter((p, i) => !needle || [raw[i].title, raw[i].executiveSummary, p.title, p.summaryHtml.replace(/<[^>]+>/g, " ")].some((x) => x.toLowerCase().includes(needle)));

  return (
    <div>
      {!member && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 bg-accent px-6 py-5 text-white">
          <p className="font-display text-2xl font-bold uppercase">{t("unlockEvery")}</p>
          <Link href="/membership" className="btn bg-ink text-white hover:bg-white hover:text-ink">{t("fromPrice")}</Link>
        </div>
      )}

      <form className="mb-8 flex gap-3">
        <input name="q" defaultValue={term} placeholder={t("searchSummaries")} className="input" />
        <button className="btn-dark shrink-0">{t("search")}</button>
      </form>

      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
        {posts.length === 1 ? t("summaryCount") : t("summariesCount", { n: posts.length })}{term && <> {t("forTerm", { q: term })} · <Link href="/account/summaries" className="text-accent hover:underline">{t("clear")}</Link></>}
      </p>

      <div className="border-t-[3px] border-ink">
        {posts.map((p, i) => (
          <details key={p.id} open={member && i === 0 && !term} className="group border-b border-ink/15">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5">
              <span>
                {p.category && <span className="kicker">{p.category.name}</span>}
                <span className="hed mt-1 block text-2xl group-hover:text-accent">{p.title}</span>
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-ink/50">{fmtDate(p.publishedAt)}</span>
              </span>
              <span className="mt-6 font-mono text-xl leading-none text-ink/40 group-open:rotate-45 transition">+</span>
            </summary>
            {member ? (
              <div className="pb-6">
                <div className="prose-article prose-base prose-h2:text-xl" dangerouslySetInnerHTML={{ __html: p.summaryHtml }} />
                <Link href={`/story/${p.slug}`} className="mt-4 inline-block font-mono text-[11px] uppercase tracking-widest text-accent hover:underline">{t("readFullStory")}</Link>
              </div>
            ) : (
              <p className="pb-6 font-serif text-ink/60">{t("membersOnlyDot")} <Link href="/membership" className="text-accent hover:underline">{t("subscribeToRead")}</Link></p>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}
