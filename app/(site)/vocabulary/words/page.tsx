import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { translateMany } from "@/lib/translate";
import { VOCAB_CATEGORIES } from "@/lib/vocab";
import { GlossaryFilter } from "@/components/GlossaryFilter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Glossary: every word and its meaning", description: "Every elegant word, AI, tech and trend term used by the tech leaders we interview, with a plain definition and who said it.", alternates: { canonical: "/vocabulary/words" } };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Every vocabulary term from published stories, one entry per word (the same word from several interviews is listed once, with each speaker). */
export default async function Glossary() {
  const { locale, t } = await getI18n();
  const rows = await db.vocabTerm.findMany({
    where: { post: { status: "published" } },
    include: { post: { select: { slug: true, title: true } } },
    orderBy: { createdAt: "asc" },
  });
  const byWord = new Map<string, { term: string; definition: string; category: string; uses: { who: string; quote: string; slug: string; title: string }[] }>();
  for (const r of rows) {
    const k = norm(r.term);
    const e = byWord.get(k) ?? { term: r.term, definition: r.definition, category: r.category, uses: [] };
    if (!e.uses.some((u) => u.slug === r.post.slug && u.who === r.who)) e.uses.push({ who: r.who, quote: r.quote, slug: r.post.slug, title: r.post.title });
    byWord.set(k, e);
  }
  const words = [...byWord.values()].sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));
  const defs = await translateMany(locale, words.map((w) => w.definition));
  const groups = VOCAB_CATEGORIES.map((c) => ({ cat: c, list: words.map((w, i) => ({ ...w, definition: defs[i] || w.definition })).filter((w) => w.category === c) })).filter((g) => g.list.length);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="kicker">{t("vocabTitle")}</p>
      <h1 className="hed border-b-[3px] border-ink pb-4 text-6xl sm:text-8xl">{t("glossaryTitle")}</h1>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl font-serif text-xl text-ink/70">{t("glossaryDek", { n: words.length })}</p>
        <Link href="/vocabulary" className="border-[3px] border-ink bg-terminal-amber px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest shadow-[4px_4px_0_#111] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111]">
          {t("glossaryPlay")} →
        </Link>
      </div>

      <nav className="sticky top-0 z-10 mt-8 flex flex-wrap items-center gap-2 border-y-[3px] border-ink bg-paper py-3">
        {groups.map((g) => (
          <a key={g.cat} href={`#${g.cat}`} className="border-2 border-ink px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-terminal-amber">
            {t(`vocab_${g.cat}` as "vocab_ai")} <span className="text-ink/50">{g.list.length}</span>
          </a>
        ))}
        <GlossaryFilter placeholder={t("glossaryFind")} />
      </nav>

      {groups.map((g) => (
        <section key={g.cat} id={g.cat} className="scroll-mt-20 pt-10">
          <h2 className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-accent">{t(`vocab_${g.cat}` as "vocab_ai")}</h2>
          <dl className="mt-3 divide-y divide-ink/10 border-t-[3px] border-ink">
            {g.list.map((w) => (
              <div key={w.term} data-glossary={`${w.term} ${w.definition}`.toLowerCase()} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <dt className="font-display text-2xl font-bold leading-tight">{w.term}</dt>
                <dd>
                  <p className="font-serif text-lg">{w.definition}</p>
                  {w.uses.map((u) => (
                    <p key={`${u.slug}-${u.who}`} className="mt-1 font-serif text-sm text-ink/60">
                      <span className="font-bold text-ink/80">{u.who}</span>
                      {u.quote && <>: “{u.quote}”</>}{" "}
                      <Link href={`/story/${u.slug}#vocabulary`} className="whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-accent hover:underline">{t("glossaryInStory")} →</Link>
                    </p>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      {!words.length && <p className="py-16 font-serif text-xl text-ink/60">{t("gameEmpty")}</p>}
    </div>
  );
}
