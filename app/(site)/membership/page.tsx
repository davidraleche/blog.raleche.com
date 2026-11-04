import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { localizeFields } from "@/lib/localize";
import { getUser, activePlan } from "@/lib/auth";
import { startCheckout, openBillingPortal } from "@/app/actions/billing";
import { money } from "@/lib/utils";
import { stripe } from "@/lib/stripe";

export const metadata = { title: "Membership" };

export default async function Membership({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { locale, t } = await getI18n();
  const [rawPlans, user, { plan: wanted }] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getUser(),
    searchParams,
  ]);
  const current = activePlan(user);
  const plans = await localizeFields(locale, rawPlans, ["name", "tagline", "features"]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <p className="kicker">{t("membership")}</p>
        <h1 className="hed mx-auto mt-3 max-w-4xl text-6xl sm:text-8xl">{t("membershipTitle")}</h1>
        <p className="mx-auto mt-6 max-w-2xl font-serif text-xl text-ink/70">
          {t("membershipText")}
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {plans.map((p, i) => {
          const highlight = i === plans.length - 1;
          const isCurrent = current === p.id;
          return (
            <div key={p.id} className={`flex flex-col border-[3px] border-ink p-8 ${highlight ? "bg-ink text-white" : ""} ${wanted === p.id ? "ring-4 ring-accent" : ""}`}>
              <p className={`font-mono text-[11px] uppercase tracking-[0.2em] ${highlight ? "text-terminal-amber" : "text-accent"}`}>{highlight ? t("mostComplete") : t("essential")}</p>
              <h2 className="hed mt-3 text-5xl">{p.name}</h2>
              <p className={`mt-2 font-serif text-lg ${highlight ? "text-white/70" : "text-ink/70"}`}>{p.tagline}</p>
              <p className="mt-6 font-display text-7xl font-extrabold">
                {money(p.priceCents)}<span className="font-mono text-base font-normal">/{p.interval === "year" ? t("year") : t("month")}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {p.features.split("\n").filter(Boolean).map((f) => (
                  <li key={f} className="flex gap-3 font-sans"><span className="text-accent">■</span>{f}</li>
                ))}
              </ul>
              {isCurrent ? (
                <p className="mt-8 border border-current py-3 text-center font-mono text-xs uppercase tracking-widest">{t("yourCurrentPlan")}</p>
              ) : current && stripe ? (
                <form action={openBillingPortal} className="mt-8"><button className={`w-full ${highlight ? "btn bg-white text-ink hover:bg-accent hover:text-white" : "btn-dark"}`}>{t("switchPlan")}</button></form>
              ) : (
                <form action={startCheckout} className="mt-8">
                  <input type="hidden" name="plan" value={p.id} />
                  <button className={`w-full ${highlight ? "btn bg-accent text-white hover:bg-white hover:text-ink" : "btn-dark"}`}>
                    {user ? t("subscribeFor", { price: money(p.priceCents) }) : t("signUpSubscribe")}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-widest text-ink/50">
        {t("securePayment")}{!stripe && t("demoMode")}
      </p>
    </div>
  );
}
