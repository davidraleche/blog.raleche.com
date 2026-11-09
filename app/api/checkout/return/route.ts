import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { stripe } from "@/lib/stripe";
import { creditTokenCheckout, unlockWithTokens } from "@/lib/tokens";
import { buyMemoWithTokens } from "@/lib/memos";
import { logActivity } from "@/lib/activity";
import { safeNext, parseThen } from "@/lib/checkout-intent";

export const dynamic = "force-dynamic";

/**
 * Stripe sends a reader here after buying tokens from the "not enough tokens" popup. Credit the tokens,
 * finish what they were trying to do (unlock a summary or buy a memo), and put them back where they were.
 */
export async function GET(req: NextRequest) {
  const base = process.env.APP_URL || req.nextUrl.origin;
  const go = (path: string) => NextResponse.redirect(new URL(path, base), 303);
  const id = req.nextUrl.searchParams.get("session_id");
  if (!stripe || !id) return go("/store");
  const s = await stripe.checkout.sessions.retrieve(id).catch(() => null);
  const md = s?.metadata ?? {};
  if (!s || md.kind !== "tokens" || !md.userId) return go("/store");
  const next = safeNext(md.next) ?? "/store";
  if (s.payment_status !== "paid") return go(next);
  await creditTokenCheckout({ id: s.id, payment_status: s.payment_status, metadata: s.metadata });

  const then = parseThen(md.then);
  const userId = md.userId;
  if (then?.kind === "unlock") {
    const r = await unlockWithTokens(userId, then.postId);
    if (r === "ok") after(() => logActivity({ kind: "unlock", userId, postId: then.postId, detail: "Unlocked the executive summary (100 tokens)" }));
    revalidatePath(next);
    return go(r === "ok" ? `${next}?unlocked=1#${then.anchor}` : `${next}#${then.anchor}`);
  }
  if (then?.kind === "memo") {
    const r = await buyMemoWithTokens(userId, then.memoId);
    if (r === "ok") after(() => logActivity({ kind: "memo", userId, detail: "Bought a memo after topping up" }));
    revalidatePath("/memos");
    revalidatePath("/account/memos");
    return go(r === "ok" || r === "already" ? `/account/memos?bought=${then.memoId}` : "/memos");
  }
  return go(`/store?added=${Number(md.tokens) || 0}`);
}
