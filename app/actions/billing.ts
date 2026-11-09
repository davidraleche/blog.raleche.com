"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { stripe, ensureStripeCustomer } from "@/lib/stripe";
import { getLocale } from "@/lib/i18n/server";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";

export async function startCheckout(form: FormData) {
  const planId = String(form.get("plan"));
  const user = await requireUser(`/membership?plan=${planId}`);
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) redirect("/membership");

  if (!stripe) {
    // Local demo mode: no Stripe keys configured, activate immediately.
    if (process.env.NODE_ENV === "production") throw new Error("Stripe is not configured");
    await db.subscription.create({
      data: { userId: user.id, planId, status: "active", priceCents: plan.priceCents, currentPeriodEnd: new Date(Date.now() + 30 * 864e5) },
    });
    redirect("/account?welcome=1");
  }

  const customerId = await ensureStripeCustomer(user);

  const session = await stripe.checkout.sessions.create({
    locale: await getLocale(),
    mode: "subscription",
    customer: customerId,
    line_items: [{
      quantity: 1,
      price_data: { currency: "usd", unit_amount: plan.priceCents, recurring: { interval: plan.interval as "month" | "year" }, product_data: { name: `Raleche ${plan.name}` } },
    }],
    subscription_data: { metadata: { userId: user.id, planId } },
    allow_promotion_codes: true,
    success_url: `${appUrl()}/account?welcome=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/membership`,
  });
  redirect(session.url!);
}

export async function openBillingPortal() {
  const user = await requireUser();
  if (!stripe || !user.stripeCustomerId) redirect("/account");
  const customer = await ensureStripeCustomer(user);
  const s = await stripe.billingPortal.sessions.create({ customer, locale: await getLocale(), return_url: `${appUrl()}/account` });
  redirect(s.url);
}

export async function cancelDemoSubscription() {
  const user = await requireUser();
  await db.subscription.updateMany({ where: { userId: user.id, stripeSubscriptionId: null, status: "active" }, data: { status: "canceled" } });
  redirect("/account");
}

export async function toggleNewsletter() {
  const user = await requireUser();
  if (!user.email) redirect("/account");
  const sub = await db.subscriber.findUnique({ where: { email: user.email } });
  await db.subscriber.upsert({
    where: { email: user.email },
    create: { email: user.email, source: "account", language: user.language ?? (await getLocale()) },
    update: { status: sub?.status === "subscribed" ? "unsubscribed" : "subscribed" },
  });
  redirect("/account");
}
