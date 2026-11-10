"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { spinQuoteWheel } from "@/app/actions/quote-wheel";
import { QUOTE_WHEEL_PRIZE } from "@/lib/token-config";

export type SpeakerQuote = { text: string; speaker: string; slug: string; title: string };
export type QuoteWheelLabels = Record<"title" | "dek" | "spin" | "spinAgain" | "quote" | "won" | "wonDetail" | "signIn" | "signInDek" | "readStory" | "close", string>;

// Ten segments clockwise from the top: two token segments (opposite each other), eight quotes, so one spin in five shows tokens.
// The server decides the outcome; the wheel only animates to a matching segment.
const SEGMENTS = ["tokens", "quote", "quote", "quote", "quote", "tokens", "quote", "quote", "quote", "quote"] as const;
const COLORS = ["#f2b51e", "#1565c0", "#e1251b", "#5cb946", "#1d4e63", "#f2b51e", "#1fb6e8", "#e1251b", "#5cb946", "#1d4e63"];
const SEG = 360 / SEGMENTS.length;
const BULBS = 28;
// Rounded so the server and the browser render identical numbers (avoids hydration warnings).
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const fill = (s: string, n: number | string) => s.replace("{n}", String(n));

type Result = { kind: "quote"; quote: SpeakerQuote } | { kind: "tokens"; amount: number; credited: boolean; balance?: number };

/** The wheel drawing. `size` is a Tailwind width class. */
function WheelFace({ rotation, spinning, glow, size, pointer, labels }: { rotation: number; spinning: boolean; glow: boolean; size: string; pointer: string; labels: QuoteWheelLabels }) {
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `${n}-${uid}`;
  return (
    <div className={`relative mx-auto aspect-square ${size}`}>
      <svg viewBox="0 0 40 52" className={`absolute left-1/2 z-10 -translate-x-1/2 drop-shadow-[0_3px_3px_rgba(0,0,0,0.45)] ${pointer}`} aria-hidden>
        <defs><linearGradient id={id("qgold")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3b0" /><stop offset="0.45" stopColor="#f2c230" /><stop offset="1" stopColor="#a8740c" /></linearGradient></defs>
        <path d="M20 50 L4 18 A16 16 0 1 1 36 18 Z" fill={`url(#${id("qgold")})`} stroke="#7a5206" strokeWidth="1.5" />
        <circle cx="20" cy="16" r="7" fill="#fff8d6" stroke="#a8740c" strokeWidth="1.5" />
      </svg>
      <svg viewBox="-120 -120 240 240" className={`h-full w-full ${glow ? "drop-shadow-[0_0_28px_rgba(255,215,106,0.9)]" : "drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"}`} aria-hidden>
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
                <text transform={`rotate(${mid}) translate(88 0)`} fill={s === "tokens" ? "#5a3c04" : "#fff"} fontSize={s === "tokens" ? 15 : 11} fontWeight="900" textAnchor="end" dominantBaseline="central" fontFamily="ui-sans-serif, system-ui" stroke={s === "tokens" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.35)"} strokeWidth="2" style={{ paintOrder: "stroke" }}>
                  {s === "tokens" ? `+${QUOTE_WHEEL_PRIZE} 🪙` : `★ ${labels.quote}`}
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
  );
}

/** The full wheel with its result panel. Spins on its own once when `autoSpin` is set, then the reader spins as often as they like. */
function WheelPanel({ quotes, labels, autoSpin = false, inModal = false }: { quotes: SpeakerQuote[]; labels: QuoteWheelLabels; autoSpin?: boolean; inModal?: boolean }) {
  const router = useRouter();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const last = useRef(-1);
  const rotRef = useRef(0);
  const started = useRef(false);

  async function spin() {
    if (spinning || !quotes.length) return;
    setSpinning(true);
    setResult(null);
    let outcome: Awaited<ReturnType<typeof spinQuoteWheel>> = { outcome: "quote" };
    try { outcome = await spinQuoteWheel(); } catch {}
    const want = outcome.outcome;
    const options = SEGMENTS.map((s, i) => (s === want ? i : -1)).filter((i) => i >= 0);
    const idx = options[Math.floor(Math.random() * options.length)];
    const centre = idx * SEG + SEG / 2;
    const target = rotRef.current - (rotRef.current % 360) + 360 * 5 + (360 - centre) + (Math.random() - 0.5) * SEG * 0.6;
    rotRef.current = target;
    setRotation(target);
    setTimeout(() => {
      if (outcome.outcome === "tokens") {
        setResult({ kind: "tokens", amount: outcome.amount, credited: outcome.credited, balance: outcome.balance });
        confetti({ particleCount: 160, spread: 110, origin: { y: 0.55 }, colors: ["#f5a623", "#ffd76a", "#fff3b0", "#ffffff"], shapes: ["star", "circle"], zIndex: 2000 });
        if (outcome.credited) router.refresh();
      } else {
        let i = Math.floor(Math.random() * quotes.length);
        if (quotes.length > 1 && i === last.current) i = (i + 1) % quotes.length; // no immediate repeats
        last.current = i;
        setResult({ kind: "quote", quote: quotes[i] });
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 }, colors: ["#f5a623", "#ffd76a", "#e1251b", "#1fb6e8", "#ffffff"], shapes: ["star", "circle"], zIndex: 2000 });
      }
      setSpinning(false);
    }, 4200);
  }

  useEffect(() => {
    if (!autoSpin || started.current) return;
    // Mark it started inside the timer, so React's dev double-run (mount, cleanup, mount) still spins once.
    const t = setTimeout(() => { if (started.current) return; started.current = true; spin(); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpin]);

  const signinHref = typeof window === "undefined" ? "/signin" : `/signin?next=${encodeURIComponent(window.location.pathname)}`;

  return (
    <section aria-label={labels.title} className={`${inModal ? "" : "col-span-full "}overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_20%,#3fa9f5_0%,#1565c0_50%,#0b3a75_100%)] p-6 text-white shadow-[0_20px_50px_rgba(0,40,120,0.35)] sm:p-10`}>
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <WheelFace rotation={rotation} spinning={spinning} glow={!!result} size={inModal ? "w-full max-w-[min(460px,62vh)]" : "w-full max-w-[420px]"} pointer="top-[-16px] w-12" labels={labels} />
        <div className="text-center lg:text-left" aria-live="polite">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#ffd76a]">{labels.title}</p>
          {!result && <h2 className="hed mt-2 text-4xl text-white sm:text-5xl">{labels.dek}</h2>}
          {result?.kind === "quote" && (
            <figure className="congrats-in mt-2">
              <blockquote className="font-serif text-2xl leading-snug text-white sm:text-3xl">“{result.quote.text}”</blockquote>
              <figcaption className="mt-4 font-mono text-[12px] uppercase tracking-widest text-[#ffd76a]">
                — {result.quote.speaker}
                <a href={`/story/${result.quote.slug}#story`} className="ml-3 text-white underline hover:text-[#ffd76a]">{labels.readStory}</a>
              </figcaption>
            </figure>
          )}
          {result?.kind === "tokens" && (
            <div className="congrats-in mt-2">
              <h2 className="hed text-5xl text-[#ffd76a] sm:text-6xl">{result.credited ? fill(labels.won, result.amount) : `+${result.amount} 🪙`}</h2>
              <p className="mt-3 font-serif text-lg text-white/90">{result.credited ? fill(labels.wonDetail, (result.balance ?? 0).toLocaleString()) : fill(labels.signInDek, result.amount)}</p>
              {!result.credited && <a href={signinHref} className="mt-4 inline-block rounded-full bg-white px-6 py-2 font-mono text-[12px] font-bold uppercase tracking-widest text-[#0b3a75] hover:bg-[#ffd76a]">{labels.signIn}</a>}
            </div>
          )}
          <button onClick={spin} disabled={spinning || !quotes.length} className="mt-6 w-full max-w-sm rounded-full bg-[linear-gradient(#ffe27a,#f2b51e)] py-4 font-display text-2xl font-extrabold uppercase tracking-wider text-[#5a3c04] shadow-[0_6px_0_#a8740c] transition hover:brightness-110 active:translate-y-1 active:shadow-[0_2px_0_#a8740c] disabled:opacity-60">
            {spinning ? "…" : result ? labels.spinAgain : labels.spin}
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Quote wheel. Inline (Play page): the full wheel. Compact (masthead): a small card; Spin opens the wheel big in a popup,
 * where it spins straight away, then the reader spins as often as they like. One spin in five lands on tokens, the rest on a speaker quote.
 */
export function QuoteWheel({ quotes, labels, compact = false }: { quotes: SpeakerQuote[]; labels: QuoteWheelLabels; compact?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!compact) return <WheelPanel quotes={quotes} labels={labels} />;

  return (
    <>
      <section aria-label={labels.title} className="overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_20%,#3fa9f5_0%,#1565c0_50%,#0b3a75_100%)] p-4 text-white shadow-[0_20px_50px_rgba(0,40,120,0.35)] sm:p-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 sm:gap-6">
          <button onClick={() => setOpen(true)} aria-label={labels.spin} className="transition hover:scale-[1.03]">
            <WheelFace rotation={0} spinning={false} glow={false} size="w-36 sm:w-48" pointer="top-[-8px] w-7" labels={labels} />
          </button>
          <div className="min-w-0 text-left">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#ffd76a]">{labels.title}</p>
            <h2 className="hed mt-2 text-xl leading-tight text-white sm:text-2xl">{labels.dek}</h2>
            <button onClick={() => setOpen(true)} disabled={!quotes.length} className="mt-3 w-full max-w-sm rounded-full bg-[linear-gradient(#ffe27a,#f2b51e)] py-2 font-display text-lg font-extrabold uppercase tracking-wider text-[#5a3c04] shadow-[0_6px_0_#a8740c] transition hover:brightness-110 active:translate-y-1 active:shadow-[0_2px_0_#a8740c] disabled:opacity-60">
              {labels.spin}
            </button>
          </div>
        </div>
      </section>
      {open && createPortal(
        <div role="dialog" aria-modal="true" aria-label={labels.title} className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/75 p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="relative w-full max-w-5xl">
            <button onClick={() => setOpen(false)} aria-label={labels.close} className="absolute -top-3 right-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-bold text-ink shadow-lg hover:bg-[#ffd76a] sm:-right-3">×</button>
            <WheelPanel quotes={quotes} labels={labels} autoSpin inModal />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
