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

export function StoryPoll({ postId, signedIn, mine, counts, earned, reward, signinHref, labels }: {
  postId: string; signedIn: boolean; mine: string | null; counts: Record<string, number>; earned: boolean; reward: number; signinHref: string; labels: L;
}) {
  const [state, action, pending] = useActionState(votePoll, null);
  useReward(state);
  const total = CHOICES.reduce((n, c) => n + (counts[c] ?? 0), 0);
  const showResults = !!mine;

  return (
    <section id="poll" className="mt-12 border-[3px] border-ink p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="hed text-3xl">{labels.pollTitle}</h2>
        {!earned && <span className="bg-terminal-amber px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest">{fill(labels.pollEarn, reward)}</span>}
      </div>
      <form action={action} className="mt-5 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="postId" value={postId} />
        {CHOICES.map((c) => {
          const n = counts[c] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const selected = mine === c;
          return signedIn ? (
            <button key={c} name="choice" value={c} disabled={pending} className={`relative overflow-hidden border-[3px] border-ink px-4 py-3 text-left font-display text-xl font-bold uppercase transition ${selected ? "bg-ink text-white" : "hover:bg-ink/5"}`}>
              {showResults && <span aria-hidden className={`absolute inset-y-0 left-0 ${selected ? "bg-accent" : "bg-terminal-amber/40"}`} style={{ width: `${pct}%` }} />}
              <span className="relative flex justify-between gap-2"><span>{labels[`poll_${c}`]}</span>{showResults && <span className="font-mono text-sm">{pct}%</span>}</span>
            </button>
          ) : (
            <a key={c} href={signinHref} className="border-[3px] border-ink px-4 py-3 font-display text-xl font-bold uppercase hover:bg-ink/5">{labels[`poll_${c}`]}</a>
          );
        })}
      </form>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-ink/60">
        {!signedIn ? <a href={signinHref} className="text-accent underline">{labels.signInToVote}</a> : mine ? <>{labels.pollThanks} · {fill(labels.votesN, total)}</> : null}
        {state?.earned ? <span className="ml-2 font-bold text-accent">{fill(labels.earnedTokens, state.earned)}</span> : null}
      </p>
    </section>
  );
}

export function CommentForm({ postId, earned, reward, labels }: { postId: string; earned: boolean; reward: number; labels: L }) {
  const [state, action, pending] = useActionState(addComment, null);
  const ref = useRef<HTMLFormElement>(null);
  useReward(state);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="mt-5">
      <input type="hidden" name="postId" value={postId} />
      <textarea name="body" required minLength={2} maxLength={2000} rows={3} placeholder={labels.commentPlaceholder} className="input min-h-[96px] w-full" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-dark">{labels.postComment}</button>
        {!earned && <span className="font-mono text-[11px] uppercase tracking-widest text-ink/60">{fill(labels.commentsEarn, reward)}</span>}
        {state?.earned ? <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-accent">{fill(labels.earnedTokens, state.earned)}</span> : null}
        {state?.error && state.error !== "invalid" && <span className="font-mono text-[11px] uppercase tracking-widest text-accent">{state.error}</span>}
      </div>
    </form>
  );
}
