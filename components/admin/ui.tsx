export function Panel({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`term-panel ${className}`}>
      <header className="flex items-center justify-between border-b border-terminal-line px-4 py-2">
        <h2 className="term-label text-terminal-amber">{title}</h2>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Delta({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className={`font-mono text-xs tabular-nums ${up ? "text-terminal-up" : "text-terminal-down"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function Stat({ label, value, sub, pct }: { label: string; value: string; sub?: string; pct?: number }) {
  return (
    <div className="term-panel px-4 py-3">
      <p className="term-label">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white xl:text-3xl">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {pct !== undefined && <Delta pct={pct} />}
        {sub && <span className="font-mono text-[10px] uppercase text-terminal-dim">{sub}</span>}
      </div>
    </div>
  );
}

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-terminal-line pb-4">
      <div>
        <h1 className="font-mono text-xl font-semibold uppercase tracking-[0.15em] text-white">{title}</h1>
        {sub && <p className="mt-1 font-mono text-xs text-terminal-dim">{sub}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Badge({ children, tone = "dim" }: { children: React.ReactNode; tone?: "up" | "down" | "amber" | "dim" }) {
  const c = { up: "text-terminal-up border-terminal-up/40", down: "text-terminal-down border-terminal-down/40", amber: "text-terminal-amber border-terminal-amber/40", dim: "text-terminal-dim border-terminal-line" }[tone];
  return <span className={`inline-block border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${c}`}>{children}</span>;
}

export function Flash({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 border-l-2 border-terminal-up bg-terminal-up/10 px-4 py-2 font-mono text-xs text-terminal-up">{children}</p>;
}

export const usd = (n: number, digits = 0) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
