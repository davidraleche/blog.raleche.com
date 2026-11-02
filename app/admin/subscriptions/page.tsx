import { db } from "@/lib/db";
import { PageTitle, Badge, Stat, usd } from "@/components/admin/ui";
import { cancelSubscription } from "../actions";
import { fmtDate } from "@/lib/utils";
import { stripe } from "@/lib/stripe";

export default async function Subscriptions() {
  const subs = await db.subscription.findMany({ include: { user: true, plan: true }, orderBy: { createdAt: "desc" } });
  const live = subs.filter((s) => ["active", "trialing", "past_due"].includes(s.status));
  const mrr = live.reduce((a, s) => a + s.priceCents, 0) / 100;
  const tone = { active: "up", trialing: "amber", past_due: "down", canceled: "dim" } as const;
  return (
    <div>
      <PageTitle title="Subscriptions" sub={stripe ? "Stripe connected" : "Stripe not configured · demo mode"}>
        {stripe && <a href="https://dashboard.stripe.com/subscriptions" target="_blank" className="term-btn-ghost">Stripe dashboard ↗</a>}
      </PageTitle>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="MRR" value={usd(mrr, 2)} />
        <Stat label="Active" value={String(live.length)} />
        <Stat label="Comped" value={String(live.filter((s) => s.priceCents === 0).length)} />
        <Stat label="Canceled" value={String(subs.length - live.length)} />
      </div>
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Member</th><th>Plan</th><th>Status</th><th className="text-right">Price</th><th>Started</th><th>Renews</th><th>Source</th><th></th></tr></thead>
          <tbody>
            {subs.length === 0 && <tr><td colSpan={8} className="text-terminal-dim">No subscriptions yet.</td></tr>}
            {subs.map((s) => (
              <tr key={s.id}>
                <td className="text-slate-100">{s.user.email || s.user.phone}</td>
                <td>{s.plan.name}</td>
                <td><Badge tone={tone[s.status as keyof typeof tone] ?? "dim"}>{s.status}{s.cancelAtPeriodEnd ? " · ending" : ""}</Badge></td>
                <td className="text-right tabular-nums">{usd(s.priceCents / 100, 2)}</td>
                <td className="text-terminal-dim">{fmtDate(s.createdAt)}</td>
                <td className="text-terminal-dim">{fmtDate(s.currentPeriodEnd)}</td>
                <td className="text-terminal-dim">{s.stripeSubscriptionId ? <a className="hover:text-white" target="_blank" href={`https://dashboard.stripe.com/subscriptions/${s.stripeSubscriptionId}`}>Stripe ↗</a> : s.priceCents ? "Demo" : "Comp"}</td>
                <td className="text-right">{s.status !== "canceled" && <form action={cancelSubscription}><input type="hidden" name="id" value={s.id} /><button className="text-terminal-down hover:underline">Cancel</button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
