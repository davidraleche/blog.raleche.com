"use client";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { votePoll, addComment, type ParticipationState } from "@/app/actions/tokens";

type L = Record<string, string>;
const fill = (s: string, n: number | string) => s.replace("{n}", String(n));

function useReward(state: ParticipationState) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      if (state.earned) confetti({ particleCount: 70, spread: 70, origin: { y: 0.75 }, colors: ["#e1251b", "#f5a623", "#0a0a0a"] });
      router.refresh();
    }
  }, [state, router]);
}

const CHOICES = ["great", "average", "not_great"] as const;
const STARS: Record<(typeof CHOICES)[number], number> = { great: 5, average: 3, not_great: 1 };
// Sparkles scattered around the poll box while it's waiting for a vote.
const SPARKLES = [
  { top: "-10px", left: "8%", size: 18, delay: "0s" }, { top: "18%", right: "-9px", size: 14, delay: "0.4s" },
  { bottom: "-10px", left: "40%", size: 16, delay: "0.8s" }, { top: "45%", left: "-8px", size: 12, delay: "1.1s" },
  { top: "-8px", right: "22%", size: 12, delay: "0.6s" }, { bottom: "20%", right: "-7px", size: 18, delay: "1.3s" },
];

function celebrate() {
  const colors = ["#f5a623", "#ffd76a", "#e1251b", "#ffffff"];
  confetti({ particleCount: 90, spread: 80, origin: { y: 0.7 }, colors, shapes: ["star"], scalar: 1.3 });
  setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors, shapes: ["star", "circle"] }), 200);
  setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors, shapes: ["star", "circle"] }), 350);
}

function Stars({ n, on }: { n: number; on: boolean }) {
  return (
    <span aria-hidden className="flex gap-0.5 text-2xl leading-none">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`poll-star inline-block ${i < n ? (on ? "text-[#ffd76a]" : "text-terminal-amber drop-shadow-[0_1px_0_#0a0a0a]") : "text-ink/15"}`}>★</span>
      ))}
    </span>
  );
}

export function StoryPoll({ postId, signedIn, mine, counts, earned, reward, signinHref, labels }: {
  postId: string; signedIn: boolean; mine: string | null; counts: Record<string, number>; earned: boolean; reward: number; signinHref: string; labels: L;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(votePoll, null);
  useEffect(() => {
    if (state?.ok) {
      celebrate();
      router.refresh();
    }
  }, [state, router]);
  const total = CHOICES.reduce((n, c) => n + (counts[c] ?? 0), 0);
  const voted = !!mine || !!state?.ok;
  const justVoted = !!state?.ok;

  return (
    <section id="poll" className={`relative mt-12 scroll-mt-24 border-[3px] border-ink bg-[linear-gradient(135deg,#fff8e6_0%,#ffffff_55%,#fff1d6_100%)] p-6 ${voted ? "shadow-[6px_6px_0_#0a0a0a]" : "poll-glow"}`}>
      {!voted && SPARKLES.map((p, i) => (
        <span key={i} aria-hidden className="sparkle pointer-events-none absolute text-terminal-amber" style={{ ...p, fontSize: p.size, animationDelay: p.delay }}>✦</span>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="hed text-3xl">{labels.pollTitle}</h2>
        {!earned && !justVoted && (
          <span className="animate-bounce bg-accent px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-white shadow-[3px_3px_0_#0a0a0a]" title={fill(labels.pollEarn, reward)}>{fill(labels.earnedTokens, reward)}</span>
        )}
      </div>
      {!voted && <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-ink/60">{labels.pollTapToVote} ↓</p>}

      <form action={action} className="mt-5 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="postId" value={postId} />
        {CHOICES.map((c) => {
          const n = counts[c] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const selected = mine === c;
          const inner = (
            <>
              {voted && <span aria-hidden className={`absolute inset-y-0 left-0 ${selected ? "bg-accent" : "bg-terminal-amber/30"}`} style={{ width: `${pct}%` }} />}
              <span className="relative flex flex-col gap-2">
                <Stars n={STARS[c]} on={selected} />
                <span className="flex items-baseline justify-between gap-2">
                  <span>{labels[`poll_${c}`]}</span>
                  {voted && <span className="font-mono text-sm">{pct}%</span>}
                </span>
              </span>
            </>
          );
          const cls = `poll-option relative overflow-hidden border-[3px] border-ink px-4 py-3 text-left font-display text-xl font-bold uppercase transition ${selected ? "bg-ink text-white" : "bg-white hover:-translate-y-1 hover:shadow-[4px_4px_0_#f5a623]"}`;
          return signedIn ? (
            <button key={c} name="choice" value={c} disabled={pending} className={cls}>{inner}</button>
          ) : (
            <a key={c} href={signinHref} className={cls}>{inner}</a>
          );
        })}
      </form>

      {justVoted ? (
        <div className="congrats-in mt-5 flex flex-wrap items-center gap-3 border-[3px] border-ink bg-terminal-amber px-4 py-3">
          <span aria-hidden className="text-2xl">★</span>
          <span className="font-display text-2xl font-extrabold uppercase">{labels.pollCongrats}</span>
          {state?.earned ? <span className="bg-ink px-2 py-0.5 font-mono text-sm font-bold text-[#ffd76a]">{fill(labels.earnedTokens, state.earned)}</span> : null}
        </div>
      ) : (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-ink/60">
          {!signedIn ? <a href={signinHref} className="text-accent underline">{labels.signInToVote}</a> : mine ? <>{labels.pollThanks} · {fill(labels.votesN, total)}</> : null}
        </p>
      )}
    </section>
  );
}

export function CommentForm({ postId, earned, reward, stamp, labels }: { postId: string; earned: boolean; reward: number; stamp: string; labels: L }) {
  const [state, action, pending] = useActionState(addComment, null);
  const ref = useRef<HTMLFormElement>(null);
  useReward(state);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="mt-5">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="stamp" value={stamp} />
      {/* Honeypot: invisible to people, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>
      <textarea name="body" required minLength={2} maxLength={1000} rows={3} placeholder={labels.commentPlaceholder} className="input min-h-[96px] w-full" />
      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-ink/40">{labels.commentRules}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-dark">{labels.postComment}</button>
        {!earned && <span className="font-mono text-[11px] uppercase tracking-widest text-ink/60">{fill(labels.commentsEarn, reward)}</span>}
        {state?.earned ? <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-accent">{fill(labels.earnedTokens, state.earned)}</span> : null}
        {state?.held && <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink">{labels.commentHeld}</span>}
        {state?.error && state.error !== "invalid" && <span className="font-mono text-[11px] uppercase tracking-widest text-accent">{state.error}</span>}
      </div>
    </form>
  );
}
