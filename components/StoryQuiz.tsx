"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { submitQuiz, type QuizResult } from "@/app/actions/tokens";

type Q = { q: string; options: string[] };
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export function StoryQuiz({ postId, questions, signedIn, played, reward, signinHref, next, labels }: {
  postId: string; questions: Q[]; signedIn: boolean; played: { correct: number; answers: number[] } | null; reward: number; signinHref: string;
  next: { slug: string; title: string } | null; labels: Record<string, string>;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<QuizResult, FormData>(submitQuiz, null);
  const result = state && !state.error ? state : played ? { correct: played.correct, earned: 0, answers: played.answers, already: true } : null;
  const won = !!result && result.correct === questions.length;

  useEffect(() => {
    if (state && !state.error && !state.already) {
      if (state.earned) confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 }, colors: ["#e1251b", "#f5a623", "#0a0a0a", "#ffd76a"] });
      router.refresh();
    }
  }, [state, router]);

  return (
    <section id="quiz" className="mt-12 border-[3px] border-ink">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-ink px-5 py-3 text-white">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{labels.quizTitle}</span>
        <span className="bg-terminal-amber px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink">+{reward}</span>
      </div>
      <form action={action} className="p-5">
        <input type="hidden" name="postId" value={postId} />
        {!result && <p className="mb-4 font-serif text-ink/70">{fill(labels.quizDek, { n: reward })}</p>}
        <ol className="space-y-6">
          {questions.map((q, i) => (
            <li key={i}>
              <p className="font-display text-xl font-bold">{i + 1}. {q.q}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((o, j) => {
                  const isAnswer = result?.answers[i] === j;
                  return (
                    <label key={j} className={`flex cursor-pointer items-start gap-2 border-2 px-3 py-2 font-serif transition ${result ? (isAnswer ? "border-green-700 bg-green-50" : "border-ink/15 text-ink/50") : "border-ink/20 hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-terminal-amber/20"}`}>
                      <input type="radio" name={`q${i}`} value={j} required disabled={!!result || !signedIn} className="mt-1 accent-[#e1251b]" />
                      <span>{o}{result && isAnswer && " ✓"}</span>
                    </label>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6">
          {!signedIn ? (
            <a href={signinHref} className="btn-dark">{labels.signInToPlay}</a>
          ) : !result ? (
            <button disabled={pending} className="btn bg-accent text-white hover:bg-ink">{labels.quizSubmit}</button>
          ) : won ? (
            <p className="font-display text-3xl font-extrabold text-accent">{result.already ? fill(labels.quizPlayed, { c: result.correct }) : fill(labels.quizWin, { n: reward })}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <p className="font-display text-2xl font-bold">{result.already ? fill(labels.quizPlayed, { c: result.correct }) : fill(labels.quizLose, { c: result.correct })}</p>
              {next && <a href={`/story/${next.slug}#quiz`} className="btn-dark">{labels.quizNext} →</a>}
            </div>
          )}
          {state?.error === "answerAll" && <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-accent">{labels.quizAnswerAll}</p>}
        </div>
      </form>
    </section>
  );
}
