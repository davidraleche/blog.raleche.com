import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { today } from "@/lib/utils";
import { vocabQuestion, quoteQuestion, type GameKind } from "@/lib/word-games";
import { WORD_GAME_DAILY_MAX, WORD_GAME_PRIZE } from "@/lib/token-config";
import { WordGame } from "./WordGame";

/** The Vocabulary ("what does it mean?") and Quotes ("who said it?") pages: a new random question on every load. */
export async function WordGamePage({ kind }: { kind: GameKind }) {
  const [{ locale, t }, user] = await Promise.all([getI18n(), getUser()]);
  const q = kind === "vocab" ? await vocabQuestion(locale) : await quoteQuestion(locale);
  const reason = kind === "vocab" ? "vocabgame" : "quotegame";
  const wonToday = user ? (await db.tokenTxn.aggregate({ where: { userId: user.id, reason, ref: { startsWith: `${reason}:${user.id}:${today()}` } }, _sum: { amount: true } }))._sum.amount ?? 0 : 0;
  const path = kind === "vocab" ? "/vocabulary" : "/quotes";
  const n = { n: WORD_GAME_PRIZE, m: WORD_GAME_DAILY_MAX };
  const labels = {
    next: t(kind === "vocab" ? "gameNextWord" : "gameNextQuote"), readStory: t("gameReadStory"), correct: t("gameCorrect"), wrong: t("gameWrong"),
    answerWas: t("gameAnswerWas"), earned: t("gameEarned"), capped: t("gameCapped", n), signIn: t("gameSignIn"), answered: t("gameAnswered"), saidIt: t("gameSaidIt"), error: t("gameError"),
  };
  const hint = q?.hint ? t(`vocab_${q.hint}` as "vocab_ai") : "";
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="kicker">{t(kind === "vocab" ? "vocabTitle" : "quotesNav")}</p>
      <h1 className="hed border-b-[3px] border-ink pb-4 text-6xl sm:text-8xl">{t(kind === "vocab" ? "vocabGameTitle" : "quoteGameTitle")}</h1>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
        <p className="max-w-2xl font-serif text-xl text-ink/70">{t(kind === "vocab" ? "vocabGameDek" : "quoteGameDek", n)}</p>
        {user && <p className="font-mono text-[11px] uppercase tracking-widest">{t("gameToday", { w: wonToday, m: WORD_GAME_DAILY_MAX })}</p>}
      </div>
      <div className="mt-10">
        {q ? <WordGame q={{ ...q, hint }} labels={labels} signInHref={`/signin?next=${encodeURIComponent(path)}`} /> : <p className="font-serif text-xl">{t("gameEmpty")}</p>}
      </div>
    </div>
  );
}
