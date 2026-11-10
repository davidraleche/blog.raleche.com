"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { answerWordGame, type GameResult } from "@/app/actions/word-games";
import type { GameQuestion } from "@/lib/word-games";

type Labels = Record<"next" | "readStory" | "correct" | "wrong" | "answerWas" | "earned" | "capped" | "signIn" | "answered" | "saidIt" | "error", string>;

/** One Vocabulary or Quotes question: pick one of four answers, see if it's right, then read the article or get the next one. */
export function WordGame({ q: initial, labels, signInHref }: { q: GameQuestion; labels: Labels; signInHref: string }) {
  // Answering sets a cookie, which makes Next.js re-render the page with a fresh question: keep the one being answered until "Next".
  const [q] = useState(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    start(async () => {
      const r = await answerWordGame(q.token, i, { prompt: q.prompt, options: q.options }).catch(() => null);
      if (r) setResult(r);
      else setFailed(true);
    });
  };

  return (
    <div className="border-[3px] border-ink">
      <div className="border-b-[3px] border-ink px-5 py-8 sm:px-8">
        {q.hint && <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{q.hint}</p>}
        {q.kind === "vocab" ? (
          <p className="hed mt-2 text-5xl sm:text-7xl">{q.prompt}</p>
        ) : (
          <blockquote className="font-display text-2xl font-bold leading-snug sm:text-4xl">“{q.prompt}”</blockquote>
        )}
      </div>
      <ol data-no-track className="grid gap-3 p-5 sm:grid-cols-2 sm:p-8">
        {q.options.map((o, i) => {
          const isAnswer = result && i === result.answer;
          const isWrongPick = result && i === picked && !result.correct;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => choose(i)}
                disabled={picked !== null}
                className={`flex h-full w-full items-start gap-3 border-2 px-4 py-3 text-left font-serif text-base transition ${
                  isAnswer ? "border-green-700 bg-green-50" : isWrongPick ? "border-accent bg-red-50" : picked === i ? "border-ink bg-ink/5" : "border-ink hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#e1251b] disabled:hover:translate-y-0 disabled:hover:shadow-none"
                } ${picked !== null && !isAnswer && picked !== i ? "opacity-50" : ""}`}
              >
                <span className="font-mono text-xs font-bold">{"ABCD"[i]}</span>
                <span className={q.kind === "quote" ? "font-display text-lg font-bold" : ""}>{o}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {pending && <p className="px-5 pb-6 font-mono text-[11px] uppercase tracking-widest text-ink/50 sm:px-8">…</p>}
      {failed && <p className="px-5 pb-6 font-serif text-accent sm:px-8">{labels.error}</p>}
      {result && (
        <div className={`border-t-[3px] border-ink px-5 py-6 sm:px-8 ${result.correct ? "bg-green-50" : "bg-red-50"}`}>
          <p className={`hed text-4xl ${result.correct ? "text-green-700" : "text-accent"}`}>{result.correct ? labels.correct : labels.wrong}</p>
          {!result.correct && <p className="mt-2 font-serif text-lg">{labels.answerWas.replace("{a}", q.options[result.answer])}</p>}
          {result.earned > 0 && <p className="mt-2 inline-block bg-terminal-amber px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest">{labels.earned.replace("{n}", String(result.earned))}</p>}
          {result.correct && result.reason === "capped" && <p className="mt-2 font-serif text-ink/70">{labels.capped}</p>}
          {result.correct && result.reason === "answered" && <p className="mt-2 font-serif text-ink/70">{labels.answered}</p>}
          {result.correct && result.reason === "signin" && (
            <p className="mt-2 font-serif">
              <Link href={signInHref} className="font-bold text-accent underline">{labels.signIn}</Link>
            </p>
          )}
          {result.who && (
            <p className="mt-3 font-serif text-sm text-ink/70">
              {labels.saidIt.replace("{who}", result.who)}
              {result.quote && <> “{result.quote}”</>}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {result.story && (
              <Link href={`/story/${result.story.slug}`} className="bg-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white hover:bg-accent">
                {labels.readStory}: {result.story.title.length > 60 ? `${result.story.title.slice(0, 57)}…` : result.story.title}
              </Link>
            )}
            <button type="button" onClick={() => window.location.reload()} className="border-2 border-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-terminal-amber">
              {labels.next} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
