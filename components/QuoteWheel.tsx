"use client";
import { useId, useRef, useState } from "react";
import confetti from "canvas-confetti";

export type SpeakerQuote = { text: string; speaker: string; slug: string; title: string };

// Eight segments clockwise from the top: a quote every other segment, so each spin is a 1-in-2 chance.
const SEGMENTS = ["quote", "miss", "quote", "miss", "quote", "miss", "quote", "miss"] as const;
const COLORS = ["#f5a623", "#1565c0", "#e1251b", "#1d4e63", "#5cb946", "#1565c0", "#1fb6e8", "#1d4e63"];
const SEG = 360 / SEGMENTS.length;
const BULBS = 28;
// Rounded so the server and the browser render identical numbers (avoids hydration warnings).
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Free, unlimited spins on the Play page. Half the time you get a quote from one of our speakers. */
export function QuoteWheel({ quotes, labels, compact = false }: { quotes: SpeakerQuote[]; labels: Record<"title" | "dek" | "spin" | "spinAgain" | "quote" | "miss" | "missDek" | "readStory", string>; compact?: boolean }) {
  // Unique gradient ids, so two wheels on one page (masthead + Play) don't share them.
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `${n}-${uid}`;
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ quote: SpeakerQuote | null } | null>(null);
  const last = useRef<number>(-1);

  function spin() {
    if (spinning || !quotes.length) return;
    setSpinning(true);
    setResult(null);
    const hit = Math.random() < 0.5;
    const options = SEGMENTS.map((s, i) => ((s === "quote") === hit ? i : -1)).filter((i) => i >= 0);
    const idx = options[Math.floor(Math.random() * options.length)];
    const centre = idx * SEG + SEG / 2;
    const target = rotation - (rotation % 360) + 360 * 5 + (360 - centre) + (Math.random() - 0.5) * SEG * 0.6;
    setRotation(target);
    setTimeout(() => {
      let quote: SpeakerQuote | null = null;
      if (hit) {
        let i = Math.floor(Math.random() * quotes.length);
        if (quotes.length > 1 && i === last.current) i = (i + 1) % quotes.length; // no immediate repeats
        last.current = i;
        quote = quotes[i];
        confetti({ particleCount: 110, spread: 90, origin: { y: 0.6 }, colors: ["#f5a623", "#ffd76a", "#e1251b", "#1fb6e8", "#ffffff"], shapes: ["star", "circle"] });
      }
      setResult({ quote });
      setSpinning(false);
    }, 4200);
  }

  return (
    <section aria-label={labels.title} className={`${compact ? "" : "col-span-full "}overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_20%,#3fa9f5_0%,#1565c0_50%,#0b3a75_100%)] text-white shadow-[0_20px_50px_rgba(0,40,120,0.35)] ${compact ? "p-4 sm:p-5" : "p-6 sm:p-10"}`}>
      <div className={`grid items-center ${compact ? "grid-cols-[auto_minmax(0,1fr)] gap-4 sm:gap-6" : "gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"}`}>
        <div className={`relative mx-auto aspect-square ${compact ? "w-36 sm:w-48" : "w-full max-w-[420px]"}`}>
          <svg viewBox="0 0 40 52" className={`absolute left-1/2 z-10 -translate-x-1/2 drop-shadow-[0_3px_3px_rgba(0,0,0,0.45)] ${compact ? "top-[-8px] w-7" : "top-[-16px] w-12"}`} aria-hidden>
            <defs><linearGradient id={id("qgold")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3b0" /><stop offset="0.45" stopColor="#f2c230" /><stop offset="1" stopColor="#a8740c" /></linearGradient></defs>
            <path d="M20 50 L4 18 A16 16 0 1 1 36 18 Z" fill={`url(#${id("qgold")})`} stroke="#7a5206" strokeWidth="1.5" />
            <circle cx="20" cy="16" r="7" fill="#fff8d6" stroke="#a8740c" strokeWidth="1.5" />
          </svg>
          <svg viewBox="-120 -120 240 240" className={`h-full w-full ${result?.quote ? "drop-shadow-[0_0_28px_rgba(255,215,106,0.9)]" : "drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"}`} aria-hidden>
            <defs>
              <radialGradient id={id("qrim")} r="0.5"><stop offset="0.86" stopColor="#0d47a1" /><stop offset="0.93" stopColor="#42a5f5" /><stop offset="1" stopColor="#0d47a1" /></radialGradient>
              <radialGradient id={id("qbulb")} r="0.5"><stop offset="0" stopColor="#ffffff" /><stop offset="0.45" stopColor="#bdf0ff" /><stop offset="1" stopColor="#29b6f6" stopOpacity="0" /></radialGradient>
              <radialGradient id={id("qhub")} r="0.5"><stop offset="0" stopColor="#fff3b0" /><stop offset="0.6" stopColor="#f2c230" /><stop offset="1" stopColor="#a8740c" /></radialGradient>
            </defs>
            <circle r="118" fill={`url(#${id("qrim")})`} />
            {Array.from({ length: BULBS }, (_, i) => {
              const a = ((i * 360) / BULBS - 90) * (Math.PI / 180);
              return <circle key={i} className={spinning ? "wheel-bulb-fast" : "wheel-bulb"} style={{ animationDelay: `${(i % 2) * 0.5}s` }} cx={r3(109 * Math.cos(a))} cy={r3(109 * Math.sin(a))} r="5.5" fill={`url(#${id("qbulb")})`} />;
            })}
            <g style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4s cubic-bezier(0.12, 0.8, 0.12, 1)" : "none" }}>
              {SEGMENTS.map((s, i) => {
                const a0 = ((i * SEG - 90) * Math.PI) / 180, a1 = (((i + 1) * SEG - 90) * Math.PI) / 180, mid = (i + 0.5) * SEG - 90, r = 98;
                return (
                  <g key={i}>
                    <path d={`M0 0 L${r3(r * Math.cos(a0))} ${r3(r * Math.sin(a0))} A${r} ${r} 0 0 1 ${r3(r * Math.cos(a1))} ${r3(r * Math.sin(a1))} Z`} fill={COLORS[i]} stroke="#fff" strokeOpacity="0.85" strokeWidth="1.2" />
                    <text transform={`rotate(${mid}) translate(88 0)`} fill="#fff" fontSize={s === "quote" ? 13 : 10} fontWeight="900" textAnchor="end" dominantBaseline="central" fontFamily="ui-sans-serif, system-ui" stroke="rgba(0,0,0,0.35)" strokeWidth="2" style={{ paintOrder: "stroke" }}>
                      {s === "quote" ? `★ ${labels.quote}` : labels.miss}
                    </text>
                  </g>
                );
              })}
            </g>
            <polygon points={Array.from({ length: 24 }, (_, i) => { const a = (i * 15 - 90) * (Math.PI / 180); const rr = i % 2 ? 16 : 32; return `${r3(rr * Math.cos(a))},${r3(rr * Math.sin(a))}`; }).join(" ")} fill="#1565c0" stroke="#90caf9" strokeWidth="1" />
            <circle r="15" fill={`url(#${id("qhub")})`} stroke="#7a5206" strokeWidth="1.5" />
            <text y="0.5" fontSize="6.5" fontWeight="900" textAnchor="middle" dominantBaseline="central" fontFamily="ui-monospace, monospace" fill="#5a3c04">RLCH</text>
          </svg>
        </div>

        <div className={compact ? "min-w-0 text-left" : "text-center lg:text-left"}>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#ffd76a]">{labels.title}</p>
          {!result && <h2 className={`hed mt-2 text-white ${compact ? "text-xl leading-tight sm:text-2xl" : "text-5xl sm:text-6xl"}`}>{labels.dek}</h2>}
          {result?.quote && (
            <figure className="congrats-in mt-2">
              <blockquote className={`font-serif leading-snug text-white ${compact ? "line-clamp-5 text-base sm:text-lg" : "text-2xl sm:text-3xl"}`}>“{result.quote.text}”</blockquote>
              <figcaption className="mt-4 font-mono text-[12px] uppercase tracking-widest text-[#ffd76a]">
                — {result.quote.speaker}
                <a href={`/story/${result.quote.slug}`} className="ml-3 text-white underline hover:text-[#ffd76a]">{labels.readStory}</a>
              </figcaption>
            </figure>
          )}
          {result && !result.quote && (
            <div className="congrats-in mt-2">
              <h2 className={`hed text-white ${compact ? "text-3xl" : "text-5xl"}`}>{labels.miss}</h2>
              <p className="mt-2 font-serif text-lg text-white/85">{labels.missDek}</p>
            </div>
          )}
          <button onClick={spin} disabled={spinning || !quotes.length} className={`w-full max-w-sm rounded-full bg-[linear-gradient(#ffe27a,#f2b51e)] font-display font-extrabold uppercase tracking-wider text-[#5a3c04] shadow-[0_6px_0_#a8740c] transition hover:brightness-110 active:translate-y-1 active:shadow-[0_2px_0_#a8740c] disabled:opacity-60 ${compact ? "mt-3 py-2 text-lg" : "mt-6 py-4 text-2xl"}`}>
            {spinning ? "…" : result ? labels.spinAgain : labels.spin}
          </button>
        </div>
      </div>
    </section>
  );
}
