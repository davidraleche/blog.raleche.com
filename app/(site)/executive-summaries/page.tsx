import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { localizeFields, localizePosts } from "@/lib/localize";
import { db } from "@/lib/db";
import { money } from "@/lib/utils";

export const metadata = { title: "Executive Summaries", description: "Every Raleche story has an executive summary for members, and our in-depth Executive Briefs are available one at a time.", alternates: { canonical: "/executive-summaries" } };

interface Brief { id: string; title: string; summary: string; price: number; image: string; url: string; articleUrl: string | null }

async function loadBriefs(): Promise<Brief[]> {
  const base = (process.env.TTS42_URL ?? "https://tech-team-strategy.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/briefs`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    return ((await res.json()) as { briefs: Brief[] }).briefs;
  } catch { return []; }
}

export default async function ExecutiveSummaries() {
  const { locale, t } = await getI18n();
  const [rawBriefs, rawStories] = await Promise.all([
    loadBriefs(),
    db.post.findMany({ where: { status: "published", NOT: { executiveSummary: "" } }, orderBy: { publishedAt: "desc" }, take: 40, select: { slug: true, title: true, dek: true, readMinutes: true } }),
  ]);
  const [briefs, stories] = await Promise.all([localizeFields(locale, rawBriefs, ["title", "summary"]), localizePosts(locale, rawStories)]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <p className="kicker">{t("executiveSummaries")}</p>
        <h1 className="hed mx-auto mt-3 max-w-4xl text-6xl sm:text-7xl">{t("esTitle")}</h1>
        <p className="mx-auto mt-6 max-w-2xl font-serif text-xl text-ink/70">
          {t("esIntro")}
        </p>
      </div>

      <h2 className="hed mt-16 text-4xl">{t("briefsForSale")}</h2>
      <p className="mt-2 font-serif text-ink/70">{t("briefsText")}</p>
      {briefs.length ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {briefs.map((b) => (
            <div key={b.id} className="flex flex-col border-[3px] border-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image} alt="" className="aspect-[1200/630] w-full border-b-[3px] border-ink object-cover" loading="lazy" />
              <div className="flex flex-1 flex-col p-5">
                <h3 className="hed text-2xl">{b.title}</h3>
                <p className="mt-2 flex-1 font-serif text-ink/70">{b.summary}</p>
                <p className="mt-4 font-display text-3xl font-extrabold">{money(b.price * 100)}</p>
                <div className="mt-3 flex flex-wrap gap-3 font-mono text-[11px] uppercase tracking-[0.15em]">
                  <a href={b.url} className="bg-ink px-4 py-2 text-white hover:bg-accent">{t("buyBrief")}</a>
                  {b.articleUrl && <a href={b.articleUrl} className="border border-ink px-4 py-2 hover:bg-ink hover:text-white">{t("readArticle")}</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-8 font-serif text-ink/70">{t("briefsDown")} <a className="underline" href="https://tech-team-strategy.com/executive-summaries">{t("seeAllBriefs")}</a>.</p>
      )}

      <h2 className="hed mt-20 text-4xl">{t("storySummaries")}</h2>
      <p className="mt-2 font-serif text-ink/70">{t("storySummariesText")} <Link className="underline" href="/membership">{t("seeMembership")}</Link></p>
      <ul className="mt-6 divide-y divide-ink/15 border-y border-ink/15">
        {stories.map((s) => (
          <li key={s.slug} className="py-4">
            <Link href={`/story/${s.slug}`} className="hed text-2xl hover:text-accent">{s.title}</Link>
            {s.dek && <p className="font-serif text-ink/70">{s.dek}</p>}
          </li>
        ))}
        {!stories.length && <li className="py-4 font-serif text-ink/70">{t("noStorySummaries")}</li>}
      </ul>
    </div>
  );
}
