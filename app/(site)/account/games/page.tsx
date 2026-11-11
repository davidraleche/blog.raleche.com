import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import { translateMany } from "@/lib/translate";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getQuiz } from "@/lib/quiz";

export const metadata = { title: "My games" };

const GAME_KINDS = ["spin_quote", "spin_daily", "quiz", "vocab", "quote_game"];
const WIN_REASONS = ["wheel", "quotewheel", "quiz", "vocabgame", "quotegame"];
const LABEL: Record<string, keyof Messages> = { spin_quote: "gameKindSpin", spin_daily: "gameKindSpin", wheel: "gameKindSpin", quotewheel: "gameKindSpin", quiz: "gameKindQuiz", vocab: "gameKindVocab", vocabgame: "gameKindVocab", quote_game: "gameKindQuotes", quotegame: "gameKindQuotes" };

type Row = { id: string; at: Date; kind: string; detail: string; correct: boolean | null; tokens: number; picks?: { q: string; picked: string; right: boolean }[] };

/** Everything the reader played: wheel spins, story quizzes, Vocabulary and Quotes answers, with what they picked and what they won. */
export default async function MyGames() {
  const user = await requireUser("/account/games");
  const { locale, t, date: fmtDate } = await getI18n();
  const [events, attempts, wins] = await Promise.all([
    db.visitorEvent.findMany({ where: { userId: user.id, kind: { in: GAME_KINDS } }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.quizAttempt.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100, include: { post: { select: { title: true, slug: true } } } }),
    db.tokenTxn.findMany({ where: { userId: user.id, reason: { in: WIN_REASONS } }, orderBy: { createdAt: "desc" }, take: 300 }),
  ]);
  // Step-by-step history starts when it was switched on; older plays come from the quiz and token records.
  const since = events.at(-1)?.createdAt ?? new Date();
  const rows: Row[] = events.map((e) => ({ id: e.id, at: e.createdAt, kind: e.kind, detail: e.detail.replace(/^Quote wheel: /, ""), correct: e.correct, tokens: e.amount ?? 0 }));
  for (const a of attempts.filter((a) => a.createdAt < since)) {
    const quiz = await getQuiz(a.postId);
    rows.push({
      id: a.id, at: a.createdAt, kind: "quiz", detail: `${a.post.title} · ${a.correct}/${quiz?.length ?? 2}`, correct: a.earned > 0, tokens: a.earned,
      // Older plays were saved without the choices: show the score only.
      picks: a.picks.length !== quiz?.length ? undefined : quiz.map((q, i) => ({ q: q.q, picked: q.options[a.picks[i]] ?? "–", right: a.picks[i] === q.answer })),
    });
  }
  for (const w of wins.filter((w) => w.createdAt < since && w.reason !== "quiz")) rows.push({ id: w.id, at: w.createdAt, kind: w.reason, detail: w.note ?? "", correct: null, tokens: w.amount });
  rows.sort((a, b) => b.at.getTime() - a.at.getTime());

  const texts = await translateMany(locale, rows.flatMap((r) => [r.detail, ...(r.picks?.flatMap((p) => [p.q, p.picked]) ?? [])]));
  let k = 0;
  for (const r of rows) {
    r.detail = texts[k++] || r.detail;
    for (const p of r.picks ?? []) { p.q = texts[k++] || p.q; p.picked = texts[k++] || p.picked; }
  }

  const answers = rows.filter((r) => r.correct !== null && r.kind !== "spin_quote");
  const won = wins.reduce((n, w) => n + w.amount, 0);
  const spins = rows.filter((r) => LABEL[r.kind] === "gameKindSpin").length;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[[t("gamesSpins"), spins], [t("gamesRightWrong"), `${answers.filter((a) => a.correct).length} / ${answers.filter((a) => !a.correct).length}`], [t("gamesTokensWon"), won]].map(([k, v]) => (
          <div key={k as string} className="border-[3px] border-ink p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink/60">{k}</p>
            <p className="hed mt-1 text-4xl">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 font-serif text-sm text-ink/60">
        {t("gamesDek")} <Link href="/account/invoices#tokens" className="text-accent underline">{t("tokenHistory")}</Link>
      </p>
      {rows.length === 0 ? (
        <div className="mt-6 border-[3px] border-ink p-6">
          <p className="font-serif text-lg">{t("gamesEmpty")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/vocabulary" className="btn-dark">{t("vocabTitle")}</Link>
            <Link href="/quotes" className="btn-light">{t("quotesNav")}</Link>
            <Link href="/play" className="btn-light">{t("play")}</Link>
          </div>
        </div>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ink/15 align-top">
                <td className="py-3 pr-4 whitespace-nowrap font-mono text-xs text-ink/50">{fmtDate(r.at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td className="py-3 pr-4 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest">{t(LABEL[r.kind] ?? "gameKindSpin")}</td>
                <td className="py-3 pr-4 font-serif">
                  {r.detail}
                  {r.picks && (
                    <ul className="mt-1 space-y-0.5 text-xs text-ink/70">
                      {r.picks.map((p, i) => <li key={i}>{p.right ? "✓" : "✗"} {p.q} → <span className="font-bold">{p.picked}</span></li>)}
                    </ul>
                  )}
                </td>
                <td className="py-3 whitespace-nowrap text-right font-mono text-xs font-bold">
                  {r.correct === true && r.kind !== "spin_quote" && <span className="text-green-700">✓ {t("gameRight")}</span>}
                  {r.correct === false && <span className="text-accent">✗ {t("gameWrongShort")}</span>}
                  {r.tokens > 0 && <span className="ml-2 text-green-700">+{r.tokens}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
