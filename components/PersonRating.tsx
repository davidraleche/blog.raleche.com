"use client";
import { useActionState, useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { ratePerson, type RatingState } from "@/app/actions/ratings";

/** 👍 / 👎 with running scores next to a speaker's or host's Follow button. Every rating gets a celebration. */
export function PersonRating({ kind, name, up, down, mine, signedIn, back, reward, earned, labels, size = "sm" }: {
  kind: "speaker" | "host" | "story"; name: string; up: number; down: number; mine: number; signedIn: boolean; back: string;
  reward: number; earned: boolean; labels: { like: string; dislike: string; earn: string; plus: string }; size?: "sm" | "md";
}) {
  const [state, action, pending] = useActionState<RatingState, FormData>(ratePerson, null);
  const [burst, setBurst] = useState<{ n: number; key: number } | null>(null);
  const value = state?.ok ? state.value ?? 0 : mine;
  const ups = state?.ok ? state.up ?? up : up;
  const downs = state?.ok ? state.down ?? down : down;

  useEffect(() => {
    if (!state?.ok || !state.value) return;
    const liked = state.value > 0;
    confetti({
      particleCount: 70, spread: 70, startVelocity: 28, origin: { y: 0.55 }, scalar: 1.1,
      colors: liked ? ["#16a34a", "#f5a623", "#ffd76a", "#ffffff"] : ["#e1251b", "#0a0a0a", "#f5a623"],
      shapes: ["star", "circle"],
    });
    setBurst({ n: state.earned ?? 0, key: Date.now() });
    const t = setTimeout(() => setBurst(null), 1800);
    return () => clearTimeout(t);
  }, [state]);

  const btn = `${size === "md" ? "px-3 py-1.5 text-[13px]" : "px-2 py-0.5 text-[11px]"} inline-flex items-center gap-1 border-2 font-mono font-bold transition hover:-translate-y-0.5 active:scale-95`;
  const signinHref = `/signin?next=${encodeURIComponent(back)}`;

  const button = (v: 1 | -1) => {
    const on = value === v;
    const tone = v > 0 ? (on ? "border-green-700 bg-green-600 text-white" : "border-ink hover:bg-green-50") : on ? "border-accent bg-accent text-white" : "border-ink hover:bg-red-50";
    const inner = (<><span aria-hidden className={on ? "animate-bounce" : ""}>{v > 0 ? "👍" : "👎"}</span><span>{v > 0 ? ups : downs}</span></>);
    return signedIn ? (
      <button name="value" value={v} disabled={pending} title={v > 0 ? labels.like : labels.dislike} aria-pressed={on} className={`${btn} ${tone}`}>{inner}</button>
    ) : (
      <a href={signinHref} title={v > 0 ? labels.like : labels.dislike} className={`${btn} ${tone}`}>{inner}</a>
    );
  };

  return (
    <form action={action} className="relative inline-flex items-center gap-1 align-middle">
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="name" value={name} /><input type="hidden" name="back" value={back} />
      {button(1)}
      {button(-1)}
      {!earned && !state?.earned && <span className="ml-1 hidden font-mono text-[10px] font-bold uppercase tracking-widest text-terminal-amber sm:inline" title={labels.earn}>+{reward}</span>}
      {burst && (
        <span key={burst.key} className="congrats-in pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest text-[#ffd76a] shadow-[3px_3px_0_#f5a623]">
          ★ {burst.n ? labels.plus.replace("{n}", String(burst.n)) : value > 0 ? labels.like : labels.dislike}
        </span>
      )}
    </form>
  );
}
