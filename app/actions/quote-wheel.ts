"use server";
import { randomInt } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { today } from "@/lib/utils";
import { credit } from "@/lib/tokens";
import { cookies } from "next/headers";
import { anonymousVisitorNote, logActivity } from "@/lib/activity";
import { QUOTE_WHEEL_DAILY_MAX, QUOTE_WHEEL_ODDS, QUOTE_WHEEL_PRIZE } from "@/lib/token-config";

export type QuoteSpin = { outcome: "quote" } | { outcome: "tokens"; amount: number; credited: boolean; balance?: number };

/**
 * One spin of the quote wheel. The server decides: one in QUOTE_WHEEL_ODDS lands on tokens, the rest on a quote.
 * Spins are unlimited, so tokens pay out at most QUOTE_WHEEL_DAILY_MAX a day per account; after that every spin lands on a quote.
 * Signed-out readers can land on tokens but must sign in to win them.
 */
export async function spinQuoteWheel(): Promise<QuoteSpin> {
  const hit = randomInt(QUOTE_WHEEL_ODDS) === 0;
  const user = await getUser();
  if (!user) {
    await alertAnonymousSpin(hit);
    return hit ? { outcome: "tokens", amount: QUOTE_WHEEL_PRIZE, credited: false } : { outcome: "quote" };
  }
  if (!hit) return { outcome: "quote" };
  // Each win of the day gets its own numbered ref, so two spins racing for the same slot can't both pay.
  const prefix = `quotewheel:${user.id}:${today()}`;
  const won = await db.tokenTxn.findMany({ where: { userId: user.id, reason: "quotewheel", ref: { startsWith: prefix } }, select: { amount: true } });
  const total = won.reduce((s, t) => s + t.amount, 0);
  if (total + QUOTE_WHEEL_PRIZE > QUOTE_WHEEL_DAILY_MAX) return { outcome: "quote" };
  const ok = await credit(user.id, QUOTE_WHEEL_PRIZE, "quotewheel", `${prefix}:${won.length + 1}`);
  if (!ok) return { outcome: "quote" };
  after(() => logActivity({ kind: "spin", userId: user.id, detail: `Won ${QUOTE_WHEEL_PRIZE} tokens on the quote wheel` }));
  const balance = (await db.user.findUnique({ where: { id: user.id }, select: { tokenBalance: true } }))?.tokenBalance;
  revalidatePath("/", "layout");
  return { outcome: "tokens", amount: QUOTE_WHEEL_PRIZE, credited: true, balance };
}

/** Tell the admin a signed-out visitor is spinning. Spins are unlimited, so only the first one per visitor per day sends an alert. */
async function alertAnonymousSpin(hit: boolean) {
  const jar = await cookies();
  const day = today();
  if (jar.get("qw_alerted")?.value === day) return;
  jar.set("qw_alerted", day, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 2 * 86400 });
  const who = await anonymousVisitorNote();
  after(() => logActivity({ kind: "spin", detail: `Anonymous visitor spun the quote wheel (${hit ? `landed on ${QUOTE_WHEEL_PRIZE} tokens, asked to sign in` : "landed on a quote"}); further spins today aren't emailed${who ? ` · ${who}` : ""}` }));
}
