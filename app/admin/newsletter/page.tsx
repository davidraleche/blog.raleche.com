import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle, Badge, Stat } from "@/components/admin/ui";
import { addSubscriber, toggleSubscriber, deleteSubscriber } from "../actions";
import { sendWeekly, sendWeeklyTest } from "../weekly-actions";
import { fmtDate } from "@/lib/utils";

const WEEKLY_MSG: Record<string, string> = {
  test: "Test sent to your email.",
  confirm: "Tick the box to confirm before sending to everyone.",
};

export default async function Newsletter({ searchParams }: { searchParams: Promise<{ weekly?: string; n?: string }> }) {
  const { weekly, n } = await searchParams;
  const [subs, campaigns] = await Promise.all([
    db.subscriber.findMany({ orderBy: { createdAt: "desc" } }),
    db.campaign.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const active = subs.filter((s) => s.status === "subscribed").length;
  return (
    <div>
      <PageTitle title="Newsletter" sub={process.env.RESEND_API_KEY ? "Sending via Resend" : "No RESEND_API_KEY · sends are logged only"}>
        <a href="/admin/newsletter/export" className="term-btn-ghost">Export CSV</a>
        <Link href="/admin/newsletter/campaigns/new" className="term-btn">+ New campaign</Link>
      </PageTitle>
      <section className="term-panel mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="term-label text-terminal-amber">Weekly briefing</p>
            <p className="mt-1 text-sm text-slate-300">Daily wheel · quizzes on new stories · the latest · most read. Built from live stories, translated per subscriber language.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/admin/newsletter/weekly-preview" target="_blank" className="term-btn-ghost">Preview</a>
            <form action={sendWeeklyTest}><button className="term-btn-ghost">Send test to me</button></form>
            <form action={sendWeekly} className="flex items-center gap-2">
              <label className="flex items-center gap-1 font-mono text-xs text-slate-300"><input type="checkbox" name="confirm" value="yes" /> confirm</label>
              <button className="term-btn">Send to {active} subscribers</button>
            </form>
          </div>
        </div>
        {weekly && <p className="mt-3 font-mono text-xs text-terminal-up">{weekly === "sent" ? `Weekly briefing sent to ${n ?? 0} subscribers.` : WEEKLY_MSG[weekly]}</p>}
      </section>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Subscribed" value={String(active)} />
        <Stat label="Unsubscribed" value={String(subs.length - active)} />
        <Stat label="Campaigns" value={String(campaigns.length)} />
        <Stat label="Sent" value={String(campaigns.filter((c) => c.status === "sent").length)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="term-panel">
          <header className="border-b border-terminal-line px-4 py-2 term-label text-terminal-amber">Campaigns</header>
          <table className="term-table">
            <thead><tr><th>Subject</th><th>Status</th><th className="text-right">Sent</th><th>Date</th></tr></thead>
            <tbody>
              {campaigns.length === 0 && <tr><td colSpan={4} className="text-terminal-dim">No campaigns yet.</td></tr>}
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/admin/newsletter/campaigns/${c.id}`} className="text-slate-100 hover:text-terminal-amber">{c.subject || "(no subject)"}</Link></td>
                  <td><Badge tone={c.status === "sent" ? "up" : "dim"}>{c.status}</Badge></td>
                  <td className="text-right tabular-nums">{c.sentCount}</td>
                  <td className="text-terminal-dim">{fmtDate(c.sentAt ?? c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="term-panel">
          <header className="border-b border-terminal-line px-4 py-2 term-label text-terminal-amber">Subscribers</header>
          <form action={addSubscriber} className="flex gap-2 border-b border-terminal-line p-3">
            <input name="email" type="email" required placeholder="add@email.com" className="term-input" /><button className="term-btn">Add</button>
          </form>
          <div className="max-h-[520px] overflow-y-auto">
            <table className="term-table">
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id}>
                    <td className="text-slate-100">{s.email}</td>
                    <td><Badge tone={s.status === "subscribed" ? "up" : "dim"}>{s.status}</Badge></td>
                    <td className="text-terminal-dim">{s.source}</td>
                    <td className="text-terminal-dim">{fmtDate(s.createdAt)}</td>
                    <td className="whitespace-nowrap text-right">
                      <form action={toggleSubscriber} className="inline"><input type="hidden" name="id" value={s.id} /><button className="mr-3 text-terminal-amber hover:underline">{s.status === "subscribed" ? "Unsub" : "Resub"}</button></form>
                      <form action={deleteSubscriber} className="inline"><input type="hidden" name="id" value={s.id} /><button className="text-terminal-down hover:underline">Del</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
