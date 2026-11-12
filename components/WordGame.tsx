"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { answerWordGame, type GameResult } from "@/app/actions/word-games";
import type { GameQuestion } from "@/lib/word-games";
import { QuestionShareVideo, type QuestionShare } from "./QuestionShareVideo";

type Labels = Record<"next" | "readStory" | "correct" | "wrong" | "answerWas" | "earned" | "capped" | "signIn" | "answered" | "saidIt" | "error" | "whereSaid" | "readQuote" | "pick", string>;

/** One Vocabulary or Quotes question: pick one of four answers, see if it's right, then read the article or get the next one. */
export function WordGame({ q: initial, labels, signInHref, share }: { q: GameQuestion; labels: Labels; signInHref: string; share?: QuestionShare }) {
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
    <>
    <div className="border-[3px] border-ink">
      <div className="border-b-[3px] border-ink px-5 py-8 sm:px-8">
        {q.hint && <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink/60">{q.hint}</p>}
        {q.kind === "vocab" ? (
          <p className="hed mt-2 text-5xl sm:text-7xl">{q.prompt}</p>
        ) : (
          <blockquote className="font-display text-2xl font-bold leading-snug sm:text-4xl">“{q.prompt}”</blockquote>
        )}
      </div>
      {picked === null && (
        <p className="flex items-center gap-3 border-b-[3px] border-ink bg-terminal-amber px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-ink sm:px-8 sm:text-sm">
          <span aria-hidden className="inline-block animate-bounce text-xl">👇</span>
          {labels.pick}
        </p>
      )}
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
                className={`group flex h-full w-full items-center gap-4 border-[3px] px-4 py-4 text-left font-serif text-base transition ${
                  isAnswer ? "border-green-700 bg-green-50 shadow-[4px_4px_0_#15803d]" : isWrongPick ? "border-ink/40 bg-ink/5 line-through decoration-ink/40" : picked === i ? "border-ink bg-ink/5" : "cursor-pointer border-ink bg-white shadow-[4px_4px_0_#111] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-terminal-amber/20 hover:shadow-[7px_7px_0_#111] active:translate-x-1 active:translate-y-1 active:shadow-none"
                } ${picked !== null && !isAnswer && picked !== i ? "opacity-50" : ""}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] font-mono text-base font-bold transition ${isAnswer ? "border-green-700 bg-green-700 text-white" : picked === null ? "border-ink bg-terminal-amber group-hover:scale-110 group-hover:bg-ink group-hover:text-white" : "border-ink bg-white"}`}>
                  {isAnswer ? "✓" : isWrongPick ? "✗" : "ABCD"[i]}
                </span>
                <span className={q.kind === "quote" ? "font-display text-lg font-bold" : ""}>{o}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {pending && <p className="px-5 pb-6 font-mono text-[11px] uppercase tracking-widest text-ink/50 sm:px-8">…</p>}
      {failed && <p className="px-5 pb-6 font-serif text-ink sm:px-8">{labels.error}</p>}
      {result && (
        <div className={`border-t-[3px] border-ink px-5 py-6 sm:px-8 ${result.correct ? "bg-green-50" : "bg-white"}`}>
          <p className={`hed text-4xl ${result.correct ? "text-green-700" : "text-ink"}`}>{result.correct ? `🎉 ${labels.correct}` : `🤔 ${labels.wrong}`}</p>
          {!result.correct && <p className="mt-2 font-serif text-lg">{labels.answerWas.replace("{a}", q.options[result.answer])}</p>}
          {result.earned > 0 && <p className="mt-2 inline-block bg-terminal-amber px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest">{labels.earned.replace("{n}", String(result.earned))}</p>}
          {result.correct && result.reason === "capped" && <p className="mt-2 font-serif text-ink/70">{labels.capped}</p>}
          {result.correct && result.reason === "answered" && <p className="mt-2 font-serif text-ink/70">{labels.answered}</p>}
          {result.correct && result.reason === "signin" && (
            <p className="mt-2 font-serif">
              <Link href={signInHref} className="font-bold underline">{labels.signIn}</Link>
            </p>
          )}
          {q.kind === "quote" && result.story && (
            <Link href={result.href ?? `/story/${result.story.slug}`} className="group mt-6 block border-[3px] border-ink bg-white transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111]">
              <span className="block bg-terminal-amber px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink">{labels.whereSaid}</span>
              <span className="block px-4 py-4">
                {result.who && <span className="block font-mono text-xs font-bold uppercase tracking-widest text-ink/60">{result.who}</span>}
                <span className="mt-1 block font-display text-xl font-bold leading-snug group-hover:underline">{result.story.title}</span>
                {result.extract && <span className="mt-3 block border-l-4 border-ink/20 pl-3 font-serif text-base leading-relaxed text-ink/80">{result.extract}</span>}
              </span>
              <span className="block bg-ink px-4 py-3 text-center font-mono text-sm font-bold uppercase tracking-widest text-white group-hover:bg-ink/85">{labels.readQuote} →</span>
            </Link>
          )}
          {q.kind === "vocab" && result.who && (
            <p className="mt-3 font-serif text-sm text-ink/70">
              {labels.saidIt.replace("{who}", result.who)}
              {result.quote && <> “{result.quote}”</>}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {result.story && q.kind === "vocab" && (
              <Link href={`/story/${result.story.slug}`} className="bg-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white hover:bg-ink/85">
                {labels.readStory}: {result.story.title.length > 60 ? `${result.story.title.slice(0, 57)}…` : result.story.title}
              </Link>
            )}
            <button type="button" onClick={() => window.location.assign(window.location.pathname)} className="border-2 border-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-terminal-amber">
              {labels.next} →
            </button>
          </div>
        </div>
      )}
    </div>
    {share && <QuestionShareVideo q={q} share={share} />}
    </>
  );
}
