import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { savePlan } from "../actions";

export default async function Plans() {
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { subscriptions: { where: { status: "active" } } } } } });
  return (
    <div>
      <PageTitle title="Plans & pricing" sub="Price changes apply to new checkouts. Existing Stripe subscribers keep their price." />
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((p) => (
          <form key={p.id} action={savePlan} className="term-panel space-y-3 p-5">
            <input type="hidden" name="id" value={p.id} />
            <div className="flex items-center justify-between"><span className="term-label text-terminal-amber">{p.id}</span><Badge tone="up">{p._count.subscriptions} active</Badge></div>
            <label className="block"><span className="term-label">Name</span><input name="name" defaultValue={p.name} className="term-input mt-1" /></label>
            <label className="block"><span className="term-label">Monthly price (USD)</span><input name="price" type="number" step="0.01" min="0" defaultValue={(p.priceCents / 100).toFixed(2)} className="term-input mt-1 text-2xl" /></label>
            <label className="block"><span className="term-label">Tagline</span><input name="tagline" defaultValue={p.tagline} className="term-input mt-1" /></label>
            <label className="block"><span className="term-label">Features (one per line)</span><textarea name="features" rows={5} defaultValue={p.features} className="term-input mt-1" /></label>
            <label className="flex items-center gap-2 font-mono text-xs"><input type="checkbox" name="active" defaultChecked={p.active} /> Offered on membership page</label>
            <button className="term-btn">Save plan</button>
          </form>
        ))}
      </div>
    </div>
  );
}
