"use client";
import { useEffect, useState } from "react";
import { QuoteWheel, type SpeakerQuote } from "./QuoteWheel";

const COLORS = ["#f5a623", "#1565c0", "#e1251b", "#1d4e63", "#5cb946", "#1565c0", "#1fb6e8", "#1d4e63"];

/** Small, slowly turning wheel in the masthead. Clicking it opens the full quote wheel. */
export function QuoteWheelButton({ quotes, labels, cta, dek, size = "sm" }: { quotes: SpeakerQuote[]; labels: Parameters<typeof QuoteWheel>[0]["labels"]; cta: string; dek?: string; size?: "sm" | "lg" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!quotes.length) return null;

  return (
    <>
      <button onClick={() => setOpen(true)} className={`group flex items-center text-left ${size === "lg" ? "gap-5 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,#3fa9f5_0%,#1565c0_55%,#0b3a75_100%)] p-4 pr-6 text-white shadow-[0_12px_30px_rgba(0,40,120,0.3)] transition hover:-translate-y-0.5" : "gap-3"}`} aria-haspopup="dialog">
        <svg viewBox="-52 -52 104 104" className={`shrink-0 drop-shadow-[0_3px_4px_rgba(0,0,0,0.25)] ${size === "lg" ? "h-28 w-28 sm:h-32 sm:w-32" : "h-14 w-14 sm:h-16 sm:w-16"}`} aria-hidden>
          <circle r="50" fill="#0d47a1" />
          <g style={{ transformOrigin: "0 0" }} className="animate-[spin_9s_linear_infinite] group-hover:animate-[spin_1.2s_linear_infinite] motion-reduce:animate-none">
            {COLORS.map((c, i) => {
              const a0 = ((i * 45 - 90) * Math.PI) / 180, a1 = (((i + 1) * 45 - 90) * Math.PI) / 180;
              const r3 = (n: number) => Math.round(n * 1000) / 1000;
              return <path key={i} d={`M0 0 L${r3(42 * Math.cos(a0))} ${r3(42 * Math.sin(a0))} A42 42 0 0 1 ${r3(42 * Math.cos(a1))} ${r3(42 * Math.sin(a1))} Z`} fill={c} stroke="#fff" strokeWidth="1" />;
            })}
          </g>
          <circle r="9" fill="#f2c230" stroke="#7a5206" strokeWidth="1.5" />
          <path d="M0 -40 L-7 -54 L7 -54 Z" fill="#f2c230" stroke="#7a5206" strokeWidth="1" />
        </svg>
        {size === "lg" ? (
          <span className="flex max-w-[15rem] flex-col gap-2">
            <span className="font-display text-3xl font-extrabold uppercase leading-none">{cta}</span>
            {dek && <span className="font-serif text-sm leading-snug text-white/85">{dek}</span>}
            <span className="mt-1 self-start rounded-full bg-[linear-gradient(#ffe27a,#f2b51e)] px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-[#5a3c04] shadow-[0_3px_0_#a8740c] group-hover:brightness-110">{labels.spin} →</span>
          </span>
        ) : (
          <span className="hidden max-w-[9rem] font-mono text-[10px] font-bold uppercase leading-tight tracking-[0.18em] text-ink group-hover:text-accent sm:block">{cta}</span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label={labels.title} className="fixed inset-0 z-50 flex items-center justify-center bg-[#04203f]/80 p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="relative grid w-full max-w-4xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 z-20 rounded border border-white/40 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-[#0b3a75]" aria-label="Close">✕</button>
            <QuoteWheel quotes={quotes} labels={labels} />
          </div>
        </div>
      )}
    </>
  );
}
