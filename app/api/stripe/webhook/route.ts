import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, syncStripeSubscription } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature")!, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.subscription) await syncStripeSubscription(await stripe.subscriptions.retrieve(String(s.subscription)));
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncStripeSubscription(event.data.object as Stripe.Subscription);
      break;
  }
  return NextResponse.json({ received: true });
}
