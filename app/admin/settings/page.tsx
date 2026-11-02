import { db } from "@/lib/db";
import { PageTitle, Flash, Badge } from "@/components/admin/ui";
import { saveSettings } from "../actions";

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
