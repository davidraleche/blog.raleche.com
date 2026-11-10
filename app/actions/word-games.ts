"use server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { today } from "@/lib/utils";
import { credit } from "@/lib/tokens";
import { logActivity } from "@/lib/activity";
import { openToken, quoteExtract } from "@/lib/word-games";
import { getLocale } from "@/lib/i18n/server";
import { translateMany } from "@/lib/translate";
import { recordEvent } from "@/lib/visitor-events";
import { WORD_GAME_DAILY_MAX, WORD_GAME_PRIZE } from "@/lib/token-config";

export type GameResult = {
  correct: boolean;
  answer: number;
  /** tokens credited for this answer (0 when wrong, signed out, capped or already answered) */
  earned: number;
  reason?: "signin" | "capped" | "answered";
  balance?: number;
  story: { slug: string; title: string } | null;
  who?: string;
  quote?: string;
  /** Quotes game: the passage of the article the quote comes from, and a link that jumps to it */
  extract?: string;
  href?: string;
};

/** Check an answer to a Vocabulary or Quotes question. Right answers pay WORD_GAME_PRIZE, up to WORD_GAME_DAILY_MAX a day per game. */
export async function answerWordGame(token: string, choice: number, shown?: { prompt: string; options: string[] }): Promise<GameResult | null> {
  const r = await answer(token, choice);
  if (r) {
    const picked = shown?.options[choice] ?? `option ${choice + 1}`;
    const right = shown?.options[r.answer] ?? `option ${r.answer + 1}`;
    const prompt = (shown?.prompt ?? "").slice(0, 140);
    const what = openToken(token)?.k === "vocab" ? `Vocabulary “${prompt}”` : `Who said “${prompt}”`;
    const pay = r.earned ? ` · +${r.earned} tokens` : r.reason === "signin" ? " · signed out, no tokens" : r.reason === "capped" ? " · daily token limit reached" : r.reason === "answered" ? " · already answered" : "";
    await recordEvent({ kind: openToken(token)?.k === "vocab" ? "vocab" : "quote_game", detail: `${what}: picked “${picked.slice(0, 120)}”, ${r.correct ? "right" : `wrong (answer: “${right.slice(0, 120)}”)`}${pay}`, correct: r.correct, amount: r.earned });
  }
  return r;
}

async function answer(token: string, choice: number): Promise<GameResult | null> {
  const p = openToken(token);
  if (!p || !Number.isInteger(choice) || choice < 0 || choice > 3) return null;
  const correct = choice === p.a;
  const row = await db.post.findUnique({ where: { slug: p.s }, select: { slug: true, title: true, body: true, speaker: true } });
  const post = row && { slug: row.slug, title: row.title };
  const term = p.r ? await db.vocabTerm.findUnique({ where: { id: p.r }, select: { who: true, quote: true } }) : null;
  const base: GameResult = { correct, answer: p.a, earned: 0, story: post, who: term?.who, quote: term?.quote || undefined };
  if (p.k === "quote" && row && p.x) {
    // Show where the line was said, and link straight to it (a text fragment: browsers scroll to and highlight it).
    const extract = quoteExtract(row.body, p.x);
    const locale = await getLocale();
    if (extract) base.extract = locale === "en" ? extract : ((await translateMany(locale, [extract]).catch(() => []))[0] || extract);
    const words = p.x.split(/\s+/);
    base.href = `/story/${row.slug}${locale === "en" ? `#:~:text=${encodeURIComponent(words.slice(0, 5).join(" "))},${encodeURIComponent(words.slice(-3).join(" "))}` : ""}`;
    base.who = row.speaker ?? undefined;
  }

  // One answer per question: a second try (another option, or a replay) never pays.
  const jar = await cookies();
  const seen = (jar.get("wg_seen")?.value ?? "").split(".").filter(Boolean);
  if (seen.includes(p.n)) return { ...base, reason: "answered" };
  jar.set("wg_seen", [...seen, p.n].slice(-30).join("."), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 86400 });
  if (!correct) return base;

  const user = await getUser();
  if (!user) return { ...base, reason: "signin" };
  const reason = p.k === "vocab" ? "vocabgame" : "quotegame";
  const prefix = `${reason}:${user.id}:${today()}`;
  // Numbered refs (unique in the database), so two answers racing for the same slot can't both pay.
  const won = await db.tokenTxn.findMany({ where: { userId: user.id, reason, ref: { startsWith: prefix } }, select: { amount: true } });
  if (won.reduce((s, w) => s + w.amount, 0) + WORD_GAME_PRIZE > WORD_GAME_DAILY_MAX) return { ...base, reason: "capped" };
  if (!(await credit(user.id, WORD_GAME_PRIZE, reason, `${prefix}:${won.length + 1}`))) return { ...base, reason: "capped" };
  after(() => logActivity({ kind: "quiz", userId: user.id, detail: `Won ${WORD_GAME_PRIZE} tokens on ${p.k === "vocab" ? "Vocabulary (what does it mean?)" : "Quotes (who said it?)"}` }));
  revalidatePath("/", "layout");
  const balance = (await db.user.findUnique({ where: { id: user.id }, select: { tokenBalance: true } }))?.tokenBalance;
  return { ...base, earned: WORD_GAME_PRIZE, balance };
}
