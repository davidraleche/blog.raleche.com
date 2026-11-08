import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { getUser } from "@/lib/auth";
import { buyTokens } from "@/app/actions/tokens";
import { stripe } from "@/lib/stripe";
import { creditTokenCheckout, TOKEN_PACKS, PARTICIPATION_REWARD } from "@/lib/tokens";
import { BCP47, type Messages } from "@/lib/i18n/messages";
import { money } from "@/lib/utils";

export const metadata = { title: "Token store", description: "Buy RALECHE tokens to unlock executive summaries. $1 = 100 tokens.", alternates: { canonical: "/store" } };

export default async function Store({ searchParams }: { searchParams: Promise<{ session_id?: string; added?: string; need?: string; next?: string }> }) {
  const { locale, t, date } = await getI18n();
  const sp = await searchParams;

  // Returning from Stripe: credit right away rather than waiting for the webhook (both are idempotent).
  // Then reload without the session id so the header shows the new balance.
  if (sp.session_id && stripe) {
    const s = await stripe.checkout.sessions.retrieve(sp.session_id).catch(() => null);
    if (s) await creditTokenCheckout({ id: s.id, payment_status: s.payment_status, metadata: s.metadata });
    redirect(s?.payment_status === "paid" ? `/store?added=${Number(s.metadata?.tokens) || 0}` : "/store");
  }
  const added = Number(sp.added) || 0;

  const user = await getUser();
  const txns = user ? await db.tokenTxn.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 }) : [];
  const fmt = (n: number) => n.toLocaleString(BCP47[locale]);
  const next = sp.next?.startsWith("/") ? sp.next : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <p className="kicker">{t("store")}</p>
        <h1 className="hed mx-auto mt-3 max-w-4xl text-6xl sm:text-8xl">{t("storeTitle")}</h1>
        <p className="mx-auto mt-6 max-w-2xl font-serif text-xl text-ink/70">{t("storeDek")}</p>
      </div>

      {added > 0 && (
        <p className="mx-auto mt-8 max-w-2xl border-[3px] border-ink bg-terminal-amber/20 px-5 py-4 text-center font-serif text-lg">
          {t("tokensAdded", { n: fmt(added) })} {next && <Link href={next} className="ml-2 underline">{t("unlockedBadge")} →</Link>}
        </p>
      )}
      {sp.need && !added && <p className="mx-auto mt-8 max-w-2xl border-[3px] border-accent px-5 py-4 text-center font-serif text-lg">{t("needMoreTokens")}</p>}

      {user && (
        <div className="mx-auto mt-10 flex max-w-md items-center justify-between border-[3px] border-ink bg-ink px-6 py-5 text-white">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-terminal-amber">{t("tokenBalanceTitle")}</span>
          <span className="font-display text-5xl font-extrabold">{fmt(user.tokenBalance)}</span>
        </div>
      )}

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {TOKEN_PACKS.map((p, i) => {
          const highlight = i === TOKEN_PACKS.length - 1;
          return (
            <form key={p.id} action={buyTokens} className={`flex flex-col items-center border-[3px] border-ink p-8 text-center ${highlight ? "bg-ink text-white" : ""}`}>
              <input type="hidden" name="pack" value={p.id} />
              <p className={`font-mono text-[11px] uppercase tracking-[0.2em] ${highlight ? "text-terminal-amber" : "text-accent"}`}>{money(p.cents)}</p>
              <p className="mt-4 font-display text-7xl font-extrabold">{fmt(p.tokens)}</p>
              <p className="font-mono text-sm uppercase tracking-widest">{t("tokensLabel")}</p>
              <button className={`mt-8 w-full ${highlight ? "btn bg-accent text-white hover:bg-white hover:text-ink" : "btn-dark"}`}>
                {user ? t("buyFor", { price: money(p.cents) }) : t("signInToBuy")}
              </button>
            </form>
          );
        })}
      </div>

      <div className="mt-14 grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="hed rule pt-3 text-3xl">{t("waysToEarn")}</h2>
          <ul className="mt-5 space-y-3 font-serif text-lg">
            <li className="flex gap-3"><span className="text-accent">■</span>{t("earnWheel")}</li>
            <li className="flex gap-3"><span className="text-accent">■</span>{t("earnPoll", { n: PARTICIPATION_REWARD })}</li>
            <li className="flex gap-3"><span className="text-accent">■</span>{t("earnComment", { n: PARTICIPATION_REWARD })}</li>
          </ul>
        </section>
        {user && (
          <section>
            <h2 className="hed rule pt-3 text-3xl">{t("recentActivity")}</h2>
            {txns.length === 0 ? (
              <p className="mt-5 font-serif text-ink/60">{t("noActivity")}</p>
            ) : (
              <table className="mt-5 w-full font-mono text-xs">
                <tbody>
                  {txns.map((x) => (
                    <tr key={x.id} className="border-b border-ink/10">
                      <td className="py-2 text-ink/50">{date(x.createdAt)}</td>
                      <td className="py-2">{t(`txn_${x.reason}` as keyof Messages) || x.reason}</td>
                      <td className={`py-2 text-right font-bold ${x.amount >= 0 ? "text-green-700" : "text-accent"}`}>{x.amount >= 0 ? "+" : ""}{fmt(x.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
