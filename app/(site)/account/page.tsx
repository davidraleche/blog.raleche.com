import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, activePlan } from "@/lib/auth";
import { stripe, syncStripeSubscription } from "@/lib/stripe";
import { signOut } from "@/app/actions/auth";
import { openBillingPortal, cancelDemoSubscription, toggleNewsletter } from "@/app/actions/billing";
import { fmtDate, money } from "@/lib/utils";

export const metadata = { title: "Account" };

export default async function Account({ searchParams }: { searchParams: Promise<{ welcome?: string; session_id?: string }> }) {
  const { welcome, session_id } = await searchParams;
  // Sync right after Checkout so access is instant even before the webhook lands.
  if (session_id && stripe) {
    const s = await stripe.checkout.sessions.retrieve(session_id).catch(() => null);
    if (s?.subscription) await syncStripeSubscription(await stripe.subscriptions.retrieve(String(s.subscription)));
  }
  const user = await requireUser();
  const plan = activePlan(user);
  const sub = user.subscriptions.find((s) => ["active", "trialing", "past_due"].includes(s.status));
  const newsletter = user.email ? await db.subscriber.findUnique({ where: { email: user.email } }) : null;

  return (
    <>
      {welcome && plan && <p className="mb-8 bg-ink px-5 py-4 font-mono text-sm text-terminal-up">✓ Welcome aboard. Executive summaries are now unlocked on every story.</p>}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="border-[3px] border-ink p-6 md:col-span-2">
          <p className="kicker">Membership</p>
          {sub ? (
            <>
              <p className="hed mt-3 text-4xl">{sub.plan.name}</p>
              <p className="mt-1 font-mono text-sm">{money(sub.priceCents)}/month · <span className="uppercase">{sub.status}</span></p>
              {sub.currentPeriodEnd && <p className="mt-1 text-sm text-ink/60">{sub.cancelAtPeriodEnd ? "Ends" : "Renews"} {fmtDate(sub.currentPeriodEnd)}</p>}
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/account/summaries" className="btn-dark">Read your executive summaries</Link>
                {sub.stripeSubscriptionId && <Link href="/account/invoices" className="btn-light">Invoices</Link>}
                {sub.stripeSubscriptionId ? (
                  <form action={openBillingPortal}><button className="btn-light">Change plan or card</button></form>
                ) : (
                  <form action={cancelDemoSubscription}><button className="btn-light">Cancel</button></form>
                )}
              </div>
            </>
          ) : plan === "executive" && user.role === "ADMIN" ? (
            <>
              <p className="mt-3 font-serif">Admins have full access.</p>
              <Link href="/account/summaries" className="btn-dark mt-6">Read executive summaries</Link>
            </>
          ) : (
            <>
              <p className="mt-3 font-serif text-lg">You're on the free plan.</p>
              <Link href="/membership" className="btn-dark mt-6">Unlock executive summaries</Link>
            </>
          )}
        </div>

        {user.email && (
          <div className="border-[3px] border-ink p-6 md:col-span-2">
            <p className="kicker">Newsletter</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <p className="font-serif text-lg">{newsletter?.status === "subscribed" ? "You get the weekly briefing." : "You're not subscribed to the weekly briefing."}</p>
              <form action={toggleNewsletter}><button className="btn-light">{newsletter?.status === "subscribed" ? "Unsubscribe" : "Subscribe"}</button></form>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-[3px] border-ink p-6 md:col-span-2">
          <p className="text-sm text-ink/60">
            Signed in as <span className="text-ink">{user.email ?? user.phone}</span> · member since {fmtDate(user.createdAt)}
          </p>
          <div className="flex flex-wrap gap-2">
            {user.role === "ADMIN" && <Link href="/admin" className="btn-dark">Admin dashboard</Link>}
            <form action={signOut}><button className="btn-light">Sign out</button></form>
          </div>
        </div>
      </section>
    </>
  );
}
