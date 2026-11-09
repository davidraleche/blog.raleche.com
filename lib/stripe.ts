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

type CustomerUser = { id: string; email: string | null; phone: string | null; name: string | null; stripeCustomerId: string | null };

/**
 * The member's Stripe customer id, creating one if needed. A stored id that this Stripe account doesn't know
 * (for example one created in test mode before the switch to live) is replaced with a fresh customer.
 */
export async function ensureStripeCustomer(user: CustomerUser): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured");
  if (user.stripeCustomerId) {
    const existing = await stripe.customers.retrieve(user.stripeCustomerId).catch((e: unknown) => {
      if ((e as { code?: string })?.code === "resource_missing") return null;
      throw e;
    });
    if (existing && !existing.deleted) return existing.id;
  }
  const c = await stripe.customers.create({ email: user.email ?? undefined, phone: user.phone ?? undefined, name: user.name ?? undefined, metadata: { userId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: c.id } });
  return c.id;
}
