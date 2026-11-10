import { VOCAB_CATEGORIES } from "@/lib/vocab";

type Term = { id: string; term: string; definition: string; category: string; who: string; quote: string };

/** The interview's vocabulary, grouped by kind: each word with its meaning and who used it. */
export function StoryVocab({ terms, labels, className = "mt-12" }: { terms: Term[]; labels: Record<string, string>; className?: string }) {
  if (!terms.length) return null;
  const groups = VOCAB_CATEGORIES.map((c) => [c, terms.filter((t) => t.category === c)] as const).filter(([, list]) => list.length);
  return (
    <section id="vocabulary" className={`${className} scroll-mt-24 border-[3px] border-ink`}>
      <div className="flex items-center justify-between bg-ink px-5 py-3 text-white">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{labels.vocabTitle}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-terminal-amber">{labels.vocabCount}</span>
      </div>
      <p className="px-5 pt-4 font-serif text-sm text-ink/70">{labels.vocabDek}</p>
      {groups.map(([cat, list]) => (
        <div key={cat} className="px-5 pt-5 last:pb-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{labels[`vocab_${cat}`]}</p>
          <dl className="mt-2 divide-y divide-ink/10">
            {list.map((t) => (
              <div key={t.id} className="py-3">
                <dt className="font-display text-lg font-bold leading-tight">{t.term}</dt>
                <dd className="mt-1 font-serif text-sm">{t.definition}</dd>
                <dd className="mt-1 font-serif text-xs text-ink/60">
                  <span className="font-bold text-ink/80">{t.who}</span>
                  {t.quote && <>: “{t.quote}”</>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
