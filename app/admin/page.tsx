import Link from "next/link";
import { dashboardMetrics } from "@/lib/metrics";
import { Panel, Stat, Badge, Delta, usd } from "@/components/admin/ui";
import { MrrChart, VolumeChart, ViewsChart, PlanMix } from "@/components/admin/Charts";
import { db } from "@/lib/db";
import { sourceFromReferrer, SOCIAL_SOURCES } from "@/lib/traffic-source";

export default async function Dashboard() {
  const [m, landings, prevLandings] = await Promise.all([
    dashboardMetrics(),
    db.pageView.findMany({ where: { landing: true, createdAt: { gte: new Date(Date.now() - 7 * 86400e3) } }, select: { source: true, referrer: true }, take: 50_000 }),
    db.pageView.findMany({ where: { landing: true, createdAt: { gte: new Date(Date.now() - 14 * 86400e3), lt: new Date(Date.now() - 7 * 86400e3) } }, select: { source: true, referrer: true }, take: 50_000 }),
  ]);
  // Traffic sources (7 days): where visits came from, by link tag (?source=) or referrer, vs the 7 days before.
  const countSources = (rows: { source: string | null; referrer: string | null }[]) => {
    const c = new Map<string, number>();
    for (const r of rows) { const k = r.source ?? sourceFromReferrer(r.referrer) ?? "direct"; c.set(k, (c.get(k) ?? 0) + 1); }
    return c;
  };
  const cur = countSources(landings), prev = countSources(prevLandings);
  const sources = [...cur.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const socialTotal = [...cur.entries()].filter(([k]) => SOCIAL_SOURCES.includes(k)).reduce((n, [, v]) => n + v, 0);
  const fmtTime = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const kindTone = { SIGNUP: "amber", SUB: "up", CHURN: "down", NEWS: "dim" } as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="MRR" value={usd(m.mrr, 2)} pct={m.mrrChangePct} sub="vs 30d" />
        <Stat label="ARR run-rate" value={usd(m.arr)} sub="MRR × 12" />
        <Stat label="Paying members" value={String(m.members)} sub={`${m.churned} churned`} />
        <Stat label="Registered users" value={String(m.users)} pct={m.signups.pct} sub={`+${m.signups.cur} 7d`} />
        <Stat label="Newsletter" value={String(m.subscribers)} pct={m.newsletter.pct} sub={`+${m.newsletter.cur} 7d`} />
        <Stat label="Page views 7d" value={m.views.cur.toLocaleString()} pct={m.views.pct} sub={`${m.totalViews.toLocaleString()} all-time`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel title="MRR · 90D" right={<span className="flex items-center gap-3 font-mono text-sm tabular-nums text-white">{usd(m.mrr, 2)} <Delta pct={m.mrrChangePct} /></span>}>
          <MrrChart data={m.mrrSeries} />
        </Panel>
        <div className="space-y-4">
          <Panel title="Plan mix"><PlanMix data={m.planMix} /></Panel>
          <Panel title="Key ratios">
            <dl className="grid grid-cols-2 gap-y-3 font-mono text-xs">
              <dt className="text-terminal-dim">CONVERSION</dt><dd className="text-right tabular-nums text-white">{m.conversion.toFixed(1)}%</dd>
              <dt className="text-terminal-dim">ARPU</dt><dd className="text-right tabular-nums text-white">{usd(m.arpu, 2)}</dd>
              <dt className="text-terminal-dim">PUBLISHED</dt><dd className="text-right tabular-nums text-white">{m.publishedPosts}</dd>
              <dt className="text-terminal-dim">DRAFTS</dt><dd className="text-right tabular-nums text-white">{m.draftPosts}</dd>
              <dt className="text-terminal-dim">CAMPAIGNS SENT</dt><dd className="text-right tabular-nums text-white">{m.campaigns}</dd>
            </dl>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Acquisition volume · 30D" right={<span className="flex gap-3 font-mono text-[10px] uppercase"><span className="text-terminal-up">■ Signups</span><span className="text-blue-500">■ Newsletter</span></span>}>
          <VolumeChart data={m.daily} />
        </Panel>
        <Panel title="Readership · 30D"><ViewsChart data={m.daily} /></Panel>
      </div>

      <Panel title={`Traffic sources · 7D · ${landings.length} visits · ${socialTotal} from social`} right={<Link href="/admin/visitors?days=7" className="term-label hover:text-white">All sources →</Link>}>
        {sources.length === 0 ? <p className="font-mono text-xs text-terminal-dim">No visits yet.</p> : (
          <table className="term-table">
            <thead><tr><th>Source</th><th className="text-right">Visits</th><th className="w-1/2">Share</th><th className="text-right">Prev 7D</th></tr></thead>
            <tbody>
              {sources.map(([k, n]) => (
                <tr key={k}>
                  <td><Link href={`/admin/visitors?source=${encodeURIComponent(k)}&days=7`} className={`hover:text-white ${SOCIAL_SOURCES.includes(k) ? "text-terminal-amber" : "text-slate-100"}`}>{k}</Link></td>
                  <td className="text-right tabular-nums">{n}</td>
                  <td><div className="h-2 bg-terminal-amber/80" style={{ width: `${Math.max(2, Math.round((n / landings.length) * 100))}%` }} /></td>
                  <td className="text-right tabular-nums text-terminal-dim">{prev.get(k) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Panel title="Top movers · articles" right={<Link href="/admin/posts" className="term-label hover:text-white">All posts →</Link>}>
          <table className="term-table">
            <thead><tr><th>#</th><th>Article</th><th>Sector</th><th className="text-right">30D</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {m.topPosts.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-terminal-dim">{String(i + 1).padStart(2, "0")}</td>
                  <td className="max-w-[340px] truncate"><Link href={`/admin/posts/${p.id}`} className="text-slate-100 hover:text-terminal-amber">{p.title}</Link></td>
                  <td className="text-terminal-dim">{p.category?.name ?? "—"}</td>
                  <td className="text-right tabular-nums text-terminal-up">{p.views30}</td>
                  <td className="text-right tabular-nums">{p.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Activity feed">
          <ul className="max-h-[360px] space-y-2 overflow-y-auto font-mono text-xs">
            {m.activity.length === 0 && <li className="text-terminal-dim">No activity yet.</li>}
            {m.activity.map((a, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-24 shrink-0 tabular-nums text-terminal-dim">{fmtTime(a.at)}</span>
                <Badge tone={kindTone[a.kind as keyof typeof kindTone]}>{a.kind}</Badge>
                <span className="truncate text-slate-300">{a.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
