import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import { translateMany } from "@/lib/translate";
import { db } from "@/lib/db";
import { requireUser, activePlan } from "@/lib/auth";
import { stripe, syncStripeSubscription } from "@/lib/stripe";
import { signOut } from "@/app/actions/auth";
import { openBillingPortal, cancelDemoSubscription, toggleNewsletter } from "@/app/actions/billing";
import { money } from "@/lib/utils";

export const metadata = { title: "Account" };

export default async function Account({ searchParams }: { searchParams: Promise<{ welcome?: string; session_id?: string }> }) {
  const { welcome, session_id } = await searchParams;
  // Sync right after Checkout so access is instant even before the webhook lands.
  if (session_id && stripe) {
    const s = await stripe.checkout.sessions.retrieve(session_id).catch(() => null);
    if (s?.subscription) await syncStripeSubscription(await stripe.subscriptions.retrieve(String(s.subscription)));
  }
  const user = await requireUser();
  const { locale, t, date: fmtDate } = await getI18n();
  const plan = activePlan(user);
  const sub = user.subscriptions.find((s) => ["active", "trialing", "past_due"].includes(s.status));
  const [planName] = sub ? await translateMany(locale, [sub.plan.name]) : [""];
  const newsletter = user.email ? await db.subscriber.findUnique({ where: { email: user.email } }) : null;

  return (
    <>
      {welcome && plan && <p className="mb-8 bg-ink px-5 py-4 font-mono text-sm text-terminal-up">{t("welcomeAboard")}</p>}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="border-[3px] border-ink p-6 md:col-span-2">
          <p className="kicker">{t("membership")}</p>
          {sub ? (
            <>
              <p className="hed mt-3 text-4xl">{planName}</p>
              <p className="mt-1 font-mono text-sm">{t("perMonth", { price: money(sub.priceCents) })} · <span className="uppercase">{t(`status_${sub.status}` as keyof Messages) ?? sub.status}</span></p>
              {sub.currentPeriodEnd && <p className="mt-1 text-sm text-ink/60">{t(sub.cancelAtPeriodEnd ? "ends" : "renews", { date: fmtDate(sub.currentPeriodEnd) })}</p>}
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/account/summaries" className="btn-dark">{t("readYourSummaries")}</Link>
                {sub.stripeSubscriptionId && <Link href="/account/invoices" className="btn-light">{t("tabInvoices")}</Link>}
                {sub.stripeSubscriptionId ? (
                  <form action={openBillingPortal}><button className="btn-light">{t("changePlanOrCard")}</button></form>
                ) : (
                  <form action={cancelDemoSubscription}><button className="btn-light">{t("cancel")}</button></form>
                )}
              </div>
            </>
          ) : plan === "executive" && user.role === "ADMIN" ? (
            <>
              <p className="mt-3 font-serif">{t("adminsFullAccess")}</p>
              <Link href="/account/summaries" className="btn-dark mt-6">{t("readSummaries")}</Link>
            </>
          ) : (
            <>
              <p className="mt-3 font-serif text-lg">{t("freePlan")}</p>
              <Link href="/membership" className="btn-dark mt-6">{t("unlockSummaries")}</Link>
            </>
          )}
        </div>

        {user.email && (
          <div className="border-[3px] border-ink p-6 md:col-span-2">
            <p className="kicker">{t("newsletter")}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <p className="font-serif text-lg">{newsletter?.status === "subscribed" ? t("newsletterOn") : t("newsletterOff")}</p>
              <form action={toggleNewsletter}><button className="btn-light">{newsletter?.status === "subscribed" ? t("unsubscribe") : t("subscribe")}</button></form>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-[3px] border-ink p-6 md:col-span-2">
          <p className="text-sm text-ink/60">
            {t("signedInAs", { who: user.email ?? user.phone ?? "", date: fmtDate(user.createdAt) })}
          </p>
          <div className="flex flex-wrap gap-2">
            {user.role === "ADMIN" && <Link href="/admin" className="btn-dark">{t("adminDashboard")}</Link>}
            <form action={signOut}><button className="btn-light">{t("signOut")}</button></form>
          </div>
        </div>
      </section>
    </>
  );
}
