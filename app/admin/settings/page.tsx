import { db } from "@/lib/db";
import { PageTitle, Flash, Badge } from "@/components/admin/ui";
import { saveSettings, saveAdSettings } from "../actions";

export default async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const rows = await db.setting.findMany();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const integrations = [
    ["Stripe payments", !!process.env.STRIPE_SECRET_KEY],
    ["Stripe webhook", !!process.env.STRIPE_WEBHOOK_SECRET],
    ["Google sign-in", !!process.env.GOOGLE_CLIENT_ID],
    ["Twilio SMS", !!process.env.TWILIO_ACCOUNT_SID],
    ["Resend email", !!process.env.RESEND_API_KEY],
  ] as const;
  return (
    <div>
      <PageTitle title="Settings" />
      {saved && <Flash>Settings saved.</Flash>}
      <div className="grid gap-4 lg:grid-cols-2">
        <form action={saveSettings} className="term-panel space-y-3 p-5">
          <p className="term-label text-terminal-amber">Site</p>
          <label className="block"><span className="term-label">Site name (logo)</span><input name="siteName" defaultValue={s.siteName} className="term-input mt-1" /></label>
          <label className="block"><span className="term-label">Tagline</span><input name="tagline" defaultValue={s.tagline} className="term-input mt-1" /></label>
          <button className="term-btn">Save</button>
        </form>
        <form action={saveAdSettings} className="term-panel space-y-3 p-5">
          <p className="term-label text-terminal-amber">Google AdSense</p>
          <label className="block"><span className="term-label">Publisher ID</span><input name="adsenseClient" defaultValue={s.adsenseClient} placeholder="ca-pub-1234567890123456" className="term-input mt-1" /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="term-label">Slot: homepage</span><input name="adSlotFeed" defaultValue={s.adSlotFeed} placeholder="1234567890" className="term-input mt-1" /></label>
            <label className="block"><span className="term-label">Slot: article top</span><input name="adSlotArticleTop" defaultValue={s.adSlotArticleTop} placeholder="1234567890" className="term-input mt-1" /></label>
            <label className="block"><span className="term-label">Slot: article end</span><input name="adSlotArticleEnd" defaultValue={s.adSlotArticleEnd} placeholder="1234567890" className="term-input mt-1" /></label>
          </div>
          <label className="flex items-center gap-2 font-mono text-xs"><input type="checkbox" name="adsHideForMembers" defaultChecked={s.adsHideForMembers !== "off"} /> Ad-free for paying members</label>
          <p className="font-mono text-[10px] leading-relaxed text-terminal-dim">Empty slots show nothing. With only the publisher ID set, AdSense Auto ads can still place ads. /ads.txt is generated from the publisher ID.</p>
          <button className="term-btn">Save</button>
        </form>
        <div className="term-panel p-5">
          <p className="term-label mb-3 text-terminal-amber">Integrations (set in .env)</p>
          <ul className="space-y-2 font-mono text-xs">
            {integrations.map(([name, ok]) => (
              <li key={name} className="flex items-center justify-between"><span>{name}</span><Badge tone={ok ? "up" : "down"}>{ok ? "Connected" : "Not set"}</Badge></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
