"use server";
import { randomInt } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { today } from "@/lib/utils";
import { credit } from "@/lib/tokens";
import { logActivity } from "@/lib/activity";
import { QUOTE_WHEEL_ODDS, QUOTE_WHEEL_PRIZE } from "@/lib/token-config";

export type QuoteSpin = { outcome: "quote" } | { outcome: "tokens"; amount: number; credited: boolean; balance?: number };

/**
 * One spin of the quote wheel. The server decides: one in QUOTE_WHEEL_ODDS lands on tokens, the rest on a quote.
 * Spins are unlimited, so tokens pay out at most once a day per account; after that every spin lands on a quote.
 * Signed-out readers can land on tokens but must sign in to win them.
 */
export async function spinQuoteWheel(): Promise<QuoteSpin> {
  if (randomInt(QUOTE_WHEEL_ODDS) !== 0) return { outcome: "quote" };
  const user = await getUser();
  if (!user) return { outcome: "tokens", amount: QUOTE_WHEEL_PRIZE, credited: false };
  const ok = await credit(user.id, QUOTE_WHEEL_PRIZE, "quotewheel", `quotewheel:${user.id}:${today()}`);
  if (!ok) return { outcome: "quote" };
  after(() => logActivity({ kind: "spin", userId: user.id, detail: `Won ${QUOTE_WHEEL_PRIZE} tokens on the quote wheel` }));
  const balance = (await db.user.findUnique({ where: { id: user.id }, select: { tokenBalance: true } }))?.tokenBalance;
  revalidatePath("/", "layout");
  return { outcome: "tokens", amount: QUOTE_WHEEL_PRIZE, credited: true, balance };
}
