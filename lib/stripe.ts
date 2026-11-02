import "server-only";
import Stripe from "stripe";
import { db } from "./db";

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

/** Mirror a Stripe subscription into our database. */
export async function syncStripeSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata.userId;
  const planId = sub.metadata.planId;
  if (!userId || !planId) return;
  // Test-mode events from other environments (e.g. local dev) reference users that don't exist here.
  if (!(await db.user.findUnique({ where: { id: userId }, select: { id: true } }))) return;
  const item = sub.items.data[0];
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  const data = {
    userId,
    planId,
    status: sub.status === "canceled" || sub.status === "incomplete_expired" ? "canceled" : sub.status,
    priceCents: item?.price?.unit_amount ?? 0,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
  await db.subscription.upsert({ where: { stripeSubscriptionId: sub.id }, create: { ...data, stripeSubscriptionId: sub.id }, update: data });
}
