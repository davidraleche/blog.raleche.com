"use server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { today } from "@/lib/utils";
import { credit } from "@/lib/tokens";
import { logActivity } from "@/lib/activity";
import { openToken } from "@/lib/word-games";
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
};

/** Check an answer to a Vocabulary or Quotes question. Right answers pay WORD_GAME_PRIZE, up to WORD_GAME_DAILY_MAX a day per game. */
export async function answerWordGame(token: string, choice: number): Promise<GameResult | null> {
  const p = openToken(token);
  if (!p || !Number.isInteger(choice) || choice < 0 || choice > 3) return null;
  const correct = choice === p.a;
  const post = await db.post.findUnique({ where: { slug: p.s }, select: { slug: true, title: true } });
  const term = p.r ? await db.vocabTerm.findUnique({ where: { id: p.r }, select: { who: true, quote: true } }) : null;
  const base: GameResult = { correct, answer: p.a, earned: 0, story: post, who: term?.who, quote: term?.quote || undefined };

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
