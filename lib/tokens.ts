import "server-only";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { after } from "next/server";
import { logActivity } from "./activity";
import { sendPurchaseInvoice } from "./receipt";

import { WHEEL, TOKEN_PACKS, UNLOCK_COST } from "./token-config";
export * from "./token-config";

/** Pick a prize on the server so the result can't be chosen by the browser. */
export function drawPrize() {
  let n = crypto.randomInt(100);
  for (const s of WHEEL) {
    if (n < s.weight) return s.prize;
    n -= s.weight;
  }
  return WHEEL[0].prize;
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/**
 * Add (or with a negative amount, remove) tokens and record why. A `ref` makes the credit idempotent:
 * the same Stripe session or spin can never be credited twice. Returns false if it was already applied.
 */
export async function credit(userId: string, amount: number, reason: string, ref?: string, note?: string) {
  try {
    await db.$transaction([
      db.tokenTxn.create({ data: { userId, amount, reason, ref, note } }),
      db.user.update({ where: { id: userId }, data: { tokenBalance: { increment: amount } } }),
    ]);
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}

/** Spend tokens to unlock a summary. Returns "ok", "already" or "insufficient". */
export async function unlockWithTokens(userId: string, postId: string): Promise<"ok" | "already" | "insufficient"> {
  if (await db.unlock.findUnique({ where: { userId_postId: { userId, postId } } })) return "already";
  try {
    return await db.$transaction(async (tx) => {
      // Only decrement if the balance covers it, so two clicks can't overspend.
      const paid = await tx.user.updateMany({ where: { id: userId, tokenBalance: { gte: UNLOCK_COST } }, data: { tokenBalance: { decrement: UNLOCK_COST } } });
      if (paid.count === 0) return "insufficient" as const;
      const u = await tx.unlock.create({ data: { userId, postId, tokens: UNLOCK_COST } });
      await tx.tokenTxn.create({ data: { userId, amount: -UNLOCK_COST, reason: "unlock", ref: `unlock:${u.id}`, note: postId } });
      return "ok" as const;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return "already";
    throw e;
  }
}

export const hasUnlocked = async (userId: string | undefined, postId: string) =>
  !!userId && !!(await db.unlock.findUnique({ where: { userId_postId: { userId, postId } }, select: { id: true } }));

/** Credit a paid Stripe checkout for a token pack. Safe to call from both the webhook and the return page. */
export async function creditTokenCheckout(session: { id: string; payment_status: string | null; metadata: Record<string, string> | null }) {
  const md = session.metadata ?? {};
  if (md.kind !== "tokens" || session.payment_status !== "paid") return false;
  const tokens = Number(md.tokens);
  if (!md.userId || !Number.isInteger(tokens) || tokens <= 0) return false;
  if (!(await db.user.findUnique({ where: { id: md.userId }, select: { id: true } }))) return false;
  const ok = await credit(md.userId, tokens, "purchase", `stripe:${session.id}`, `${tokens} tokens`);
  if (ok) {
    await logActivity({ kind: "purchase", userId: md.userId, detail: `Bought ${tokens} tokens for $${(tokens / 100).toFixed(2)}` });
    // Only the call that actually credited sends the invoice, so the webhook and the return page never both send it.
    const send = () => sendPurchaseInvoice(session.id, md.userId, tokens);
    try {
      after(send); // after the response, so the buyer isn't kept waiting
    } catch {
      await send(); // outside a request (scripts)
    }
  }
  return ok;
}
