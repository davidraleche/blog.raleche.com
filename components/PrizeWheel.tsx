"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { spinWheel, claimSpin } from "@/app/actions/tokens";

export type WheelLabels = Record<
  "wheelTitle" | "wheelDek" | "spin" | "youWon" | "youWonOne" | "addedToBalance" | "signInToCollect" | "collectPrize" | "prizeCollected" | "comeBackTomorrow" | "alreadySpun" | "dailySpin" | "close" | "soundOn" | "soundOff" | "tokensLabel",
  string
>;

// Sixteen game-show segments, clockwise from the top; each prize appears four times.
const SEGMENTS = [10, 1, 30, 1, 20, 1, 10, 1, 20, 10, 1, 30, 1, 10, 20, 1];
const COLORS = ["#e8312a", "#1fb6e8", "#1d4e63", "#5cb946", "#f59e1b", "#e8312a", "#1fb6e8", "#1d4e63", "#5cb946", "#f59e1b", "#e8312a", "#1fb6e8", "#1d4e63", "#5cb946", "#f59e1b", "#1fb6e8"];
const SEG = 360 / SEGMENTS.length;
const BULBS = 24;

const fill = (s: string, n: number | string) => s.replace("{n}", String(n));
const todayKey = () => new Date().toISOString().slice(0, 10);

/* ---------- Sound: synthesized, no audio files ---------- */
let ctx: AudioContext | null = null;
function audio() {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}
function tone(freq: number, at: number, dur: number, type: OscillatorType = "triangle", vol = 0.18) {
  const a = audio();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, a.currentTime + at);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + dur + 0.05);
}
const tick = () => tone(1400, 0, 0.03, "square", 0.05);
function fanfare() {
  // Rising arpeggio, then a held major chord.
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.18));
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, 0.5, 0.9, "triangle", 0.12));
  [1318.5, 1568, 2093].forEach((f, i) => tone(f, 0.55 + i * 0.07, 0.25, "sine", 0.06));
}

/* ---------- Confetti and fireworks ---------- */
function celebrate() {
  const colors = ["#e1251b", "#f5a623", "#0a0a0a", "#ffffff", "#ffd700"];
  confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors, zIndex: 10000 });
  const end = Date.now() + 2500;
  const burst = () => {
    // Fireworks: bursts at random spots in the upper half of the screen.
    confetti({ particleCount: 50, startVelocity: 30, spread: 360, ticks: 70, gravity: 0.9, origin: { x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.35 }, colors, shapes: ["star", "circle"], scalar: 1.1, zIndex: 10000 });
    if (Date.now() < end) setTimeout(burst, 280);
  };
  burst();
  confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors, zIndex: 10000 });
  confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors, zIndex: 10000 });
}

type Phase = "idle" | "spinning" | "won" | "done";

export function PrizeWheel({ signedIn, canSpin, claimPending, labels }: { signedIn: boolean; canSpin: boolean; claimPending: boolean; labels: WheelLabels }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [rotation, setRotation] = useState(0);
  const [prize, setPrize] = useState(0);
  const [message, setMessage] = useState<{ headline: string; detail: string; collect?: boolean } | null>(null);
  const [muted, setMuted] = useState(false);
  const [available, setAvailable] = useState(canSpin);
  const mutedRef = useRef(false);

  useEffect(() => {
    try { const m = localStorage.getItem("wheel-muted") === "1"; setMuted(m); mutedRef.current = m; } catch {}
  }, []);

  // Just signed in with a prize from a signed-out spin: collect it and celebrate.
  useEffect(() => {
    if (!signedIn || !claimPending) return;
    claimSpin().then((r) => {
      if (!r) return;
      setPrize(r.prize);
      setPhase("won");
      setMessage({ headline: fill(labels.prizeCollected, r.prize), detail: fill(labels.addedToBalance, r.balance.toLocaleString()) });
      setOpen(true);
      setAvailable(false);
      celebrate();
      router.refresh();
    });
  }, [signedIn, claimPending, labels, router]);

  // Offer the spin once a day, a moment after the page loads.
  useEffect(() => {
    if (!canSpin || claimPending || pathname.startsWith("/signin")) return;
    let seen = false;
    try { seen = localStorage.getItem("wheel-offered") === todayKey(); } catch {}
    if (seen) return;
    const id = setTimeout(() => {
      setOpen(true);
      try { localStorage.setItem("wheel-offered", todayKey()); } catch {}
    }, 1500);
    return () => clearTimeout(id);
  }, [canSpin, claimPending, pathname]);

  function toggleMute() {
    const m = !muted;
    setMuted(m);
    mutedRef.current = m;
    try { localStorage.setItem("wheel-muted", m ? "1" : "0"); } catch {}
  }

  async function spin() {
    if (phase !== "idle") return;
    setPhase("spinning");
    if (!mutedRef.current) audio().resume();
    let result: Awaited<ReturnType<typeof spinWheel>>;
    try {
      result = await spinWheel();
    } catch {
      setPhase("idle"); // server hiccup: let them try again
      return;
    }
    setPrize(result.prize);

    // Land the centre of a segment with this prize under the pointer at the top.
    const options = SEGMENTS.map((p, i) => (p === result.prize ? i : -1)).filter((i) => i >= 0);
    const idx = options[Math.floor(Math.random() * options.length)];
    const centre = idx * SEG + SEG / 2;
    const jitter = (Math.random() - 0.5) * SEG * 0.6;
    const target = rotation - (rotation % 360) + 360 * 6 + (360 - centre) + jitter;
    setRotation(target);

    // Ticks that slow down with the wheel.
    if (!mutedRef.current) {
      let t = 0, gap = 40;
      while (t < 4800) { setTimeout(tick, t); t += gap; gap *= 1.07; }
    }

    setTimeout(() => {
      setPhase("won");
      setAvailable(false);
      if (!mutedRef.current) fanfare();
      celebrate();
      if (result.already) setMessage({ headline: fill(labels.alreadySpun, result.prize), detail: labels.comeBackTomorrow, collect: !result.credited });
      else if (result.credited) {
        setMessage({ headline: (result.prize === 1 ? labels.youWonOne : fill(labels.youWon, result.prize)), detail: fill(labels.addedToBalance, (result.balance ?? 0).toLocaleString()) });
        router.refresh();
      } else setMessage({ headline: (result.prize === 1 ? labels.youWonOne : fill(labels.youWon, result.prize)), detail: labels.signInToCollect, collect: true });
    }, 5200);
  }

  return (
    <>
      {available && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 border-[3px] border-ink bg-terminal-amber px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink shadow-[4px_4px_0_#111] transition hover:-translate-y-0.5"
        >
          <span aria-hidden className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ink border-t-accent" />
          {labels.dailySpin}
        </button>
      )}

      {open && (
        <div role="dialog" aria-modal="true" aria-label={labels.wheelTitle} className="fixed inset-0 z-50 flex items-center justify-center bg-[#04203f]/80 p-4" onClick={(e) => e.target === e.currentTarget && phase !== "spinning" && setOpen(false)}>
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_30%,#3fa9f5_0%,#1565c0_55%,#0b3a75_100%)] p-6 text-center text-white shadow-[0_20px_60px_rgba(0,40,120,0.6)]">
            <div className="absolute right-3 top-3 flex gap-2 font-mono text-[10px] uppercase tracking-widest">
              <button onClick={toggleMute} className="rounded border border-white/40 px-2 py-1 hover:bg-white hover:text-[#0b3a75]" aria-pressed={!muted}>{muted ? labels.soundOff : labels.soundOn}</button>
              {phase !== "spinning" && <button onClick={() => setOpen(false)} className="rounded border border-white/40 px-2 py-1 hover:bg-white hover:text-[#0b3a75]">{labels.close}</button>}
            </div>

            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.25em] text-[#ffd76a]">{labels.dailySpin}</p>
            <h2 className="hed mt-1 text-5xl text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">{phase === "won" && message ? message.headline : labels.wheelTitle}</h2>
            <p className="mt-2 font-serif text-white/85">{phase === "won" && message ? message.detail : labels.wheelDek}</p>

            <div className="relative mx-auto mt-6 aspect-square w-full max-w-[320px]">
              {/* Gold pointer */}
              <svg viewBox="0 0 40 52" className="absolute left-1/2 top-[-14px] z-10 w-11 -translate-x-1/2 drop-shadow-[0_3px_3px_rgba(0,0,0,0.45)]" aria-hidden>
                <defs>
                  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3b0" /><stop offset="0.45" stopColor="#f2c230" /><stop offset="1" stopColor="#a8740c" /></linearGradient>
                </defs>
                <path d="M20 50 L4 18 A16 16 0 1 1 36 18 Z" fill="url(#gold)" stroke="#7a5206" strokeWidth="1.5" />
                <circle cx="20" cy="16" r="7" fill="#fff8d6" stroke="#a8740c" strokeWidth="1.5" />
              </svg>
              <svg
                viewBox="-120 -120 240 240"
                className={`h-full w-full ${phase === "won" ? "drop-shadow-[0_0_24px_rgba(255,215,106,0.9)]" : "drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)]"}`}
                aria-hidden
              >
                <defs>
                  <radialGradient id="rim" r="0.5"><stop offset="0.86" stopColor="#0d47a1" /><stop offset="0.93" stopColor="#42a5f5" /><stop offset="1" stopColor="#0d47a1" /></radialGradient>
                  <radialGradient id="bulb" r="0.5"><stop offset="0" stopColor="#ffffff" /><stop offset="0.45" stopColor="#bdf0ff" /><stop offset="1" stopColor="#29b6f6" stopOpacity="0" /></radialGradient>
                  <radialGradient id="shine" cx="0.5" cy="0.2" r="0.8"><stop offset="0" stopColor="#ffffff" stopOpacity="0.28" /><stop offset="0.6" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
                  <radialGradient id="hub" r="0.5"><stop offset="0" stopColor="#fff3b0" /><stop offset="0.6" stopColor="#f2c230" /><stop offset="1" stopColor="#a8740c" /></radialGradient>
                </defs>
                {/* Rim with twinkling bulbs (does not rotate) */}
                <circle r="118" fill="url(#rim)" />
                {Array.from({ length: BULBS }, (_, i) => {
                  const a = ((i * 360) / BULBS - 90) * (Math.PI / 180);
                  return <circle key={i} className={phase === "spinning" || phase === "won" ? "wheel-bulb-fast" : "wheel-bulb"} style={{ animationDelay: `${(i % 2) * 0.5}s` }} cx={109 * Math.cos(a)} cy={109 * Math.sin(a)} r="6" fill="url(#bulb)" />;
                })}
                {/* Spinning face */}
                <g style={{ transform: `rotate(${rotation}deg)`, transition: phase === "spinning" ? "transform 5s cubic-bezier(0.12, 0.8, 0.12, 1)" : "none" }}>
                  <circle r="100" fill="#0b2f5e" />
                  {SEGMENTS.map((p, i) => {
                    const a0 = ((i * SEG - 90) * Math.PI) / 180;
                    const a1 = (((i + 1) * SEG - 90) * Math.PI) / 180;
                    const midDeg = (i + 0.5) * SEG - 90;
                    const r = 98;
                    return (
                      <g key={i}>
                        <path d={`M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`} fill={COLORS[i]} stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.2" />
                        {/* Label runs outward from the centre, like a game-show wheel */}
                        <text transform={`rotate(${midDeg}) translate(90 0)`} fill="#ffffff" fontSize="21" fontWeight="900" textAnchor="end" dominantBaseline="central" fontFamily="ui-sans-serif, system-ui" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,0.4)" strokeWidth="2.5">
                          {p}
                        </text>
                      </g>
                    );
                  })}
                  <circle r="98" fill="url(#shine)" />
                </g>
                {/* Starburst hub */}
                <polygon
                  points={Array.from({ length: 24 }, (_, i) => { const a = (i * 15 - 90) * (Math.PI / 180); const rr = i % 2 ? 16 : 34; return `${rr * Math.cos(a)},${rr * Math.sin(a)}`; }).join(" ")}
                  fill="#1565c0" stroke="#90caf9" strokeWidth="1"
                />
                <circle r="16" fill="url(#hub)" stroke="#7a5206" strokeWidth="1.5" />
                <text y="0.5" fontSize="7" fontWeight="900" textAnchor="middle" dominantBaseline="central" fontFamily="ui-monospace, monospace" fill="#5a3c04">RLCH</text>
              </svg>
            </div>

            {phase === "won" && (
              <p className="mt-4 animate-bounce font-display text-6xl font-extrabold text-[#ffd76a] drop-shadow-[0_3px_0_rgba(0,0,0,0.35)]">+{prize} <span className="text-2xl">{labels.tokensLabel}</span></p>
            )}

            <div className="mt-6">
              {phase === "idle" && <button onClick={spin} className="w-full rounded-full bg-[linear-gradient(#ffe27a,#f2b51e)] py-4 font-display text-2xl font-extrabold uppercase tracking-wider text-[#5a3c04] shadow-[0_6px_0_#a8740c] transition hover:brightness-110 active:translate-y-1 active:shadow-[0_2px_0_#a8740c]">{labels.spin}</button>}
              {phase === "spinning" && <button disabled className="w-full rounded-full bg-white/20 py-4 font-display text-2xl font-extrabold text-white">…</button>}
              {phase === "won" && message?.collect && (
                <a href={`/signin?next=${encodeURIComponent(pathname)}`} className="block w-full rounded-full bg-[linear-gradient(#ffe27a,#f2b51e)] py-4 font-display text-xl font-extrabold uppercase tracking-wider text-[#5a3c04] shadow-[0_6px_0_#a8740c] hover:brightness-110">{labels.collectPrize}</a>
              )}
              {phase === "won" && !message?.collect && <p className="font-mono text-[11px] uppercase tracking-widest text-white/80">{labels.comeBackTomorrow}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
