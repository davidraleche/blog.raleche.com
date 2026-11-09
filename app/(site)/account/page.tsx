import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { FollowButton } from "@/components/FollowButton";
import { personSlug } from "@/lib/people";
import { stripe, syncStripeSubscription } from "@/lib/stripe";
import { signOut } from "@/app/actions/auth";
import { toggleNewsletter, openBillingPortal } from "@/app/actions/billing";

export const metadata = { title: "Account" };

export default async function Account({ searchParams }: { searchParams: Promise<{ welcome?: string; session_id?: string }> }) {
  const { welcome, session_id } = await searchParams;
  // Sync right after Checkout so access is instant even before the webhook lands.
  if (session_id && stripe) {
    const s = await stripe.checkout.sessions.retrieve(session_id).catch(() => null);
    if (s?.subscription) await syncStripeSubscription(await stripe.subscriptions.retrieve(String(s.subscription)));
  }
  const user = await requireUser();
  const { t, date: fmtDate } = await getI18n();
  const [unlockCount, follows] = await Promise.all([
    db.unlock.count({ where: { userId: user.id } }),
    db.follow.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const newsletter = user.email ? await db.subscriber.findUnique({ where: { email: user.email } }) : null;

  return (
    <>
      {welcome && <p className="mb-8 bg-ink px-5 py-4 font-mono text-sm text-terminal-up">{t("welcomeAboard")}</p>}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="border-[3px] border-ink p-6 md:col-span-2">
          <p className="kicker">{t("tokenEconomy")}</p>
          <p className="hed mt-3 text-5xl">{user.tokenBalance.toLocaleString()} <span className="font-mono text-base font-normal uppercase">{t("tokensLabel")}</span></p>
          <p className="mt-2 font-serif text-lg">{t("tokensCardText", { n: unlockCount })}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/store" className="btn-dark">{t("getTokens")}</Link>
            <Link href="/account/summaries" className="btn-light">{t("readYourSummaries")}</Link>
            <Link href="/account/invoices" className="btn-light">{t("tabInvoices")}</Link>
            {stripe && user.stripeCustomerId && <form action={openBillingPortal}><button className="btn-light">{t("manageCards")}</button></form>}
          </div>
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

      <section className="mt-6 border-[3px] border-ink p-6">
        <p className="kicker">{t("followingTitle")}</p>
        {follows.length === 0 ? (
          <p className="mt-3 font-serif text-ink/70">{t("followNone")} <Link href="/speakers" className="text-accent underline">{t("speakers")}</Link> · <Link href="/hosts" className="text-accent underline">{t("hosts")}</Link></p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-3">
            {follows.map((f) => (
              <li key={f.id} className="flex items-center gap-2 border border-ink/20 py-1 pl-3 pr-1">
                <Link href={`/${f.kind === "speaker" ? "speakers" : "hosts"}#${personSlug(f.name)}`} className="font-serif hover:text-accent">{f.name}</Link>
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50">{t(f.kind === "speaker" ? "kind_speaker" : "kind_host")}</span>
                <FollowButton kind={f.kind as "speaker" | "host"} name={f.name} following signedIn back="/account" labels={{ follow: t("follow"), following: t("followingBtn"), unfollow: t("unfollow") }} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
