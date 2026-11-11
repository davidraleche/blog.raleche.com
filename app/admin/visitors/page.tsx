import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { countryLabel } from "@/lib/geo";
import { visitorName } from "@/lib/visitor-name";
import { VisitorDetail } from "./VisitorDetail";
import { sourceFromReferrer, SOCIAL_SOURCES } from "@/lib/traffic-source";

type PV = { id: string; visitorId: string; sessionId: string; userId: string | null; path: string; title: string; referrer: string | null; source: string | null; sharedBy: string | null; landing: boolean; country: string | null; seconds: number; createdAt: Date };

const fmtSec = (s: number) => (s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);
const time = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
const short = (t: string, n = 60) => (t.length > n ? `${t.slice(0, n)}…` : t);

/** Where a visit came from: its ?source= tag, else its referrer's site (older visits), else direct. */
const visitSource = (s: PV[]) => s.find((v) => v.source)?.source ?? sourceFromReferrer(s[0].referrer) ?? "direct";
const slugOf = (path: string) => (path.startsWith("/story/") ? path.replace("/story/", "").split(/[?#/]/)[0] : null);

function top<K>(items: K[], key: (k: K) => string, n = 10) {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function Table({ title, rows, unit = "" }: { title: string; rows: [string, number | string][]; unit?: string }) {
  return (
    <div className="term-panel p-4">
      <h3 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-terminal-amber">{title}</h3>
      {rows.length === 0 ? <p className="text-terminal-dim">No data yet.</p> : (
        <table className="term-table"><tbody>
          {rows.map(([k, v]) => <tr key={k}><td className="max-w-xs truncate text-slate-100" title={k}>{k}</td><td className="text-right">{v}{unit}</td></tr>)}
        </tbody></table>
      )}
    </div>
  );
}

export default async function Visitors({ searchParams }: { searchParams: Promise<{ days?: string; user?: string; visitor?: string; source?: string }> }) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = new Date(Date.now() - days * 86400e3);

  if (sp.visitor) return <VisitorDetail visitorId={sp.visitor} days={days} />;
  if (sp.user) return <UserDetail userId={sp.user} since={since} days={days} />;
  if (sp.source) return <SourceDetail source={sp.source} since={since} days={days} />;

  const views: PV[] = await db.pageView.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, take: 100_000 });
  const sessions = new Map<string, PV[]>();
  for (const v of views) sessions.set(v.sessionId, [...(sessions.get(v.sessionId) ?? []), v]);
  const visits = [...sessions.values()];
  const landings = visits.map((s) => s[0]);
  const exits = visits.map((s) => s[s.length - 1]);
  // Traffic sources: every visit by where it came from (link tag ?source=…, else referrer), and how good those visits were.
  const bySource = new Map<string, PV[][]>();
  for (const v of visits) { const k = visitSource(v); bySource.set(k, [...(bySource.get(k) ?? []), v]); }
  const titleOf = new Map(views.map((v) => [v.path, v.title.replace(/ \| RALECHE$/, "")]));
  const sourceRows = [...bySource.entries()].map(([source, vs]) => {
    const pages = vs.reduce((n, s) => n + s.length, 0);
    const secs = vs.reduce((n, s) => n + s.reduce((t, v) => t + v.seconds, 0), 0);
    const topLanding = top(vs.map((s) => s[0]), (v) => v.path, 1)[0];
    return {
      source, visits: vs.length, visitors: new Set(vs.map((s) => s[0].visitorId)).size, tagged: vs.filter((s) => s.some((v) => v.source)).length,
      pagesPer: pages / vs.length, bounce: Math.round((vs.filter((s) => s.length === 1).length / vs.length) * 100), avgVisit: secs / vs.length,
      members: new Set(vs.flatMap((s) => s.map((v) => v.userId)).filter(Boolean)).size, topLanding,
    };
  }).sort((a, b) => b.visits - a.visits);
  // Stories × social network: visits that landed on a story from each network.
  const storySocial = new Map<string, Record<string, number>>();
  for (const v of visits) {
    const src = visitSource(v), slug = slugOf(v[0].path);
    if (!slug || !SOCIAL_SOURCES.includes(src)) continue;
    const row = storySocial.get(v[0].path) ?? {};
    row[src] = (row[src] ?? 0) + 1;
    storySocial.set(v[0].path, row);
  }
  const storySocialRows = [...storySocial.entries()].map(([path, row]) => ({ path, row, total: Object.values(row).reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total);
  // Readers who share: visits their links (?by=) brought, how many were new, and the tokens they earned for it.
  const sharerVisits = new Map<string, PV[][]>();
  for (const v of visits) { const by = v.find((x) => x.sharedBy)?.sharedBy; if (by) sharerVisits.set(by, [...(sharerVisits.get(by) ?? []), v]); }
  const [sharerUsers, shareTxns] = await Promise.all([
    db.user.findMany({ where: { id: { in: [...sharerVisits.keys()] } }, select: { id: true, email: true, phone: true, name: true } }),
    db.tokenTxn.groupBy({ by: ["userId"], where: { reason: "share", createdAt: { gte: since } }, _sum: { amount: true }, _count: true }),
  ]);
  const sharerIds = new Set([...sharerVisits.keys(), ...shareTxns.map((x) => x.userId)]);
  const extraUsers = await db.user.findMany({ where: { id: { in: [...sharerIds].filter((id) => !sharerUsers.some((u) => u.id === id)) } }, select: { id: true, email: true, phone: true, name: true } });
  const sharerRows = [...sharerIds].map((id) => {
    const u = [...sharerUsers, ...extraUsers].find((x) => x.id === id);
    const vs = sharerVisits.get(id) ?? [];
    const tx = shareTxns.find((x) => x.userId === id);
    return {
      id, label: u ? (u.name ? `${u.name} · ` : "") + (u.email ?? u.phone ?? "") : id, visits: vs.length, visitors: new Set(vs.map((s) => s[0].visitorId)).size,
      rewarded: tx?._count ?? 0, tokens: tx?._sum.amount ?? 0, networks: top(vs, (s) => visitSource(s), 3).map(([k, n]) => `${k} ${n}`).join(", "),
      stories: top(vs, (s) => titleOf.get(s[0].path) || s[0].path, 2).map(([k, n]) => `${short(k, 35)} (${n})`).join(" · "),
    };
  }).sort((a, b) => b.visits - a.visits || b.tokens - a.tokens);
  const socialVisits = sourceRows.filter((r) => SOCIAL_SOURCES.includes(r.source)).reduce((n, r) => n + r.visits, 0);

  const bounce = visits.length ? Math.round((visits.filter((s) => s.length === 1).length / visits.length) * 100) : 0;
  const timed = views.filter((v) => v.seconds > 0);
  const avgTime = timed.length ? timed.reduce((n, v) => n + v.seconds, 0) / timed.length : 0;

  // Stories: views, time, poll, comments, quiz plays, unlocks.
  const storyViews = views.filter((v) => v.path.startsWith("/story/"));
  const bySlug = new Map<string, { views: number; seconds: number; timed: number; readers: Set<string> }>();
  for (const v of storyViews) {
    const slug = v.path.replace("/story/", "").split(/[?#]/)[0];
    const s = bySlug.get(slug) ?? { views: 0, seconds: 0, timed: 0, readers: new Set<string>() };
    s.views++; s.readers.add(v.visitorId);
    if (v.seconds > 0) { s.seconds += v.seconds; s.timed++; }
    bySlug.set(slug, s);
  }
  const posts = await db.post.findMany({
    where: { status: "published" },
    select: { id: true, slug: true, title: true, _count: { select: { comments: { where: { hidden: false } }, quizAttempts: true, unlocks: true } }, votes: { select: { choice: true } } },
  });
  const SCORE: Record<string, number> = { great: 5, average: 3, not_great: 1 };
  const stories = posts.map((p) => {
    const s = bySlug.get(p.slug);
    const stars = p.votes.length ? p.votes.reduce((n, v) => n + (SCORE[v.choice] ?? 0), 0) / p.votes.length : 0;
    const avg = s?.timed ? s.seconds / s.timed : 0;
    // "Love" score: attention plus engagement.
    const love = (s?.readers.size ?? 0) + avg / 30 + p.votes.length * 2 + stars + p._count.comments * 3 + p._count.quizAttempts * 2 + p._count.unlocks * 5;
    return { ...p, views: s?.views ?? 0, readers: s?.readers.size ?? 0, avg, stars, love };
  }).sort((a, b) => b.love - a.love);

  // Signed-in readers.
  const userIds = [...new Set(views.map((v) => v.userId).filter(Boolean) as string[])];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, phone: true, name: true } });
  const members = users.map((u) => {
    const mine = views.filter((v) => v.userId === u.id);
    return { ...u, views: mine.length, visits: new Set(mine.map((v) => v.sessionId)).size, seconds: mine.reduce((n, v) => n + v.seconds, 0), last: mine[mine.length - 1]?.createdAt };
  }).sort((a, b) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0));

  // Every visitor (signed in or not) under their visitor name: visits, what they did, where they last left.
  const events = await db.visitorEvent.findMany({ where: { createdAt: { gte: since } }, select: { visitorId: true, kind: true, correct: true, amount: true }, take: 200_000 });
  const evBy = new Map<string, typeof events>();
  for (const e of events) evBy.set(e.visitorId, [...(evBy.get(e.visitorId) ?? []), e]);
  const byVisitor = new Map<string, PV[]>();
  for (const v of views) byVisitor.set(v.visitorId, [...(byVisitor.get(v.visitorId) ?? []), v]);
  const everVisits = await db.pageView.groupBy({ by: ["visitorId"], where: { visitorId: { in: [...byVisitor.keys()] }, landing: true }, _count: true, _min: { createdAt: true } });
  const visitorRows = [...byVisitor.entries()].map(([vid, vs]) => {
    const ev = evBy.get(vid) ?? [];
    const ever = everVisits.find((x) => x.visitorId === vid);
    const answered = ev.filter((e) => e.correct !== null);
    const uid = vs.find((v) => v.userId)?.userId;
    return {
      vid, came: visitSource(vs.filter((v) => v.sessionId === vs[0].sessionId)), name: visitorName(vid), member: uid ? users.find((u) => u.id === uid) : undefined, country: vs[0].country,
      visits: Math.max(ever?._count ?? 0, new Set(vs.map((v) => v.sessionId)).size), firstSeen: ever?._min.createdAt ?? vs[0].createdAt, last: vs[vs.length - 1],
      pages: vs.length, spins: ev.filter((e) => e.kind.startsWith("spin")).length, right: answered.filter((e) => e.correct).length, wrong: answered.filter((e) => !e.correct).length,
      won: ev.reduce((n, e) => n + (e.amount ?? 0), 0), clicks: ev.filter((e) => e.kind === "click").length,
    };
  }).sort((a, b) => b.last.createdAt.getTime() - a.last.createdAt.getTime()).slice(0, 300);

  return (
    <div>
      <PageTitle title="Visitors" sub={`Last ${days} days · page views, landing and exit pages, what readers like`} />
      <div className="mb-4 flex gap-3 font-mono text-[11px] uppercase tracking-widest">
        {[7, 30, 90].map((d) => <Link key={d} href={`/admin/visitors?days=${d}`} className={d === days ? "text-terminal-amber" : "text-terminal-dim hover:text-slate-100"}>{d} days</Link>)}
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[["Visits", visits.length], ["Visitors", new Set(views.map((v) => v.visitorId)).size], ["Signed-in readers", userIds.length], ["Page views", views.length], ["Bounce rate", `${bounce}%`], ["Avg time on page", fmtSec(avgTime)]].map(([k, v]) => (
          <div key={k as string} className="term-panel p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-terminal-dim">{k}</p><p className="mt-1 text-xl text-slate-100">{v}</p></div>
        ))}
      </div>

      <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-terminal-amber">Traffic sources · where visits come from ({socialVisits} from social networks) · click a source for its visits</h2>
      <div className="term-panel mb-6 overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Source</th><th className="text-right">Visits</th><th className="text-right">Share</th><th className="text-right">Visitors</th><th className="text-right">From tagged links</th><th className="text-right">Pages / visit</th><th className="text-right">Bounce</th><th className="text-right">Avg visit</th><th className="text-right">Signed in</th><th>Top landing page</th></tr></thead>
          <tbody>
            {sourceRows.length === 0 && <tr><td colSpan={10} className="text-terminal-dim">No visits yet.</td></tr>}
            {sourceRows.map((r) => (
              <tr key={r.source}>
                <td className="whitespace-nowrap"><Link href={`/admin/visitors?source=${encodeURIComponent(r.source)}&days=${days}`} className={`hover:text-terminal-amber ${SOCIAL_SOURCES.includes(r.source) ? "text-terminal-amber" : "text-slate-100"}`}>{r.source}</Link></td>
                <td className="text-right">{r.visits}</td><td className="text-right">{Math.round((r.visits / visits.length) * 100)}%</td><td className="text-right">{r.visitors}</td>
                <td className="text-right">{r.tagged || "–"}</td><td className="text-right">{r.pagesPer.toFixed(1)}</td><td className="text-right">{r.bounce}%</td>
                <td className="text-right">{fmtSec(r.avgVisit)}</td><td className="text-right">{r.members || "–"}</td>
                <td className="max-w-[18rem] truncate" title={r.topLanding?.[0]}>{r.topLanding ? `${short(titleOf.get(r.topLanding[0]) || r.topLanding[0], 45)} (${r.topLanding[1]})` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-terminal-amber">Stories × social networks (visits that landed on the story)</h2>
      <div className="term-panel mb-6 overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Story</th>{SOCIAL_SOURCES.map((s) => <th key={s} className="text-right">{s}</th>)}<th className="text-right">Total</th></tr></thead>
          <tbody>
            {storySocialRows.length === 0 && <tr><td colSpan={SOCIAL_SOURCES.length + 2} className="text-terminal-dim">No visits from social networks yet. Share links carry ?source=twitter, linkedin, facebook, instagram, tiktok or youtube.</td></tr>}
            {storySocialRows.map((r) => (
              <tr key={r.path}>
                <td><Link href={r.path} className="text-slate-100 hover:text-terminal-amber">{short(titleOf.get(r.path) || r.path, 55)}</Link></td>
                {SOCIAL_SOURCES.map((s) => <td key={s} className="text-right">{r.row[s] || "–"}</td>)}
                <td className="text-right text-slate-100">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-terminal-amber">Who shared · readers whose share links (?by=) brought visits, and the tokens they earned</h2>
      <div className="term-panel mb-6 overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Reader</th><th className="text-right">Visits brought</th><th className="text-right">Visitors</th><th className="text-right">Rewarded</th><th className="text-right">Tokens earned</th><th>Networks</th><th>Stories</th></tr></thead>
          <tbody>
            {sharerRows.length === 0 && <tr><td colSpan={7} className="text-terminal-dim">No visits from readers&apos; share links yet.</td></tr>}
            {sharerRows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap"><Link href={`/admin/visitors?user=${r.id}&days=${days}`} className="text-slate-100 hover:text-terminal-amber">{r.label}</Link></td>
                <td className="text-right">{r.visits}</td><td className="text-right">{r.visitors}</td><td className="text-right">{r.rewarded || "–"}</td>
                <td className="text-right text-terminal-amber">{r.tokens ? `+${r.tokens}` : "–"}</td>
                <td className="whitespace-nowrap">{r.networks}</td><td className="max-w-[22rem] truncate" title={r.stories}>{r.stories}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Table title="Countries (visits)" rows={top(landings, (v) => countryLabel(v.country))} />
        <Table title="Landing pages (where visits start)" rows={top(landings, (v) => v.path)} />
        <Table title="Exit pages (where visits end)" rows={top(exits, (v) => v.path)} />
        <Table title="Referring sites (raw referrer)" rows={top(landings.filter((v) => v.referrer), (v) => v.referrer!.split("/")[0])} />
      </div>

      <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-terminal-amber">Every visitor (newest first) · click a name for everything they did</h2>
      <div className="term-panel mb-6 overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Visitor</th><th>Country</th><th>Came from</th><th className="text-right">Visits</th><th className="text-right">Pages</th><th className="text-right">Clicks</th><th className="text-right">Spins</th><th className="text-right">Right / wrong</th><th className="text-right">Tokens won</th><th>First seen</th><th>Last seen</th><th>Left from</th></tr></thead>
          <tbody>
            {visitorRows.length === 0 && <tr><td colSpan={12} className="text-terminal-dim">No visitors yet.</td></tr>}
            {visitorRows.map((r) => (
              <tr key={r.vid}>
                <td className="whitespace-nowrap"><Link href={`/admin/visitors?visitor=${encodeURIComponent(r.vid)}&days=${days}`} className="text-slate-100 hover:text-terminal-amber">{r.name}</Link>{r.member && <span className="ml-2 text-terminal-amber">{r.member.name || r.member.email || r.member.phone}</span>}</td>
                <td className="whitespace-nowrap">{countryLabel(r.country)}</td>
                <td className={`whitespace-nowrap ${SOCIAL_SOURCES.includes(r.came) ? "text-terminal-amber" : "text-terminal-dim"}`}>{r.came}</td>
                <td className="text-right">{r.visits}{r.visits > 1 && <span className="text-terminal-up"> ↺</span>}</td><td className="text-right">{r.pages}</td><td className="text-right">{r.clicks}</td><td className="text-right">{r.spins}</td>
                <td className="text-right">{r.right + r.wrong ? `${r.right} / ${r.wrong}` : "–"}</td><td className="text-right">{r.won || "–"}</td>
                <td className="whitespace-nowrap text-terminal-dim">{time(r.firstSeen)}</td><td className="whitespace-nowrap text-terminal-dim">{time(r.last.createdAt)}</td>
                <td className="max-w-[16rem] truncate" title={r.last.path}>{r.last.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-terminal-amber">What readers like most</h2>
      <div className="term-panel mb-6 overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Story</th><th className="text-right">Readers</th><th className="text-right">Views</th><th className="text-right">Avg time</th><th className="text-right">Rating</th><th className="text-right">Votes</th><th className="text-right">Comments</th><th className="text-right">Quiz plays</th><th className="text-right">Unlocks</th></tr></thead>
          <tbody>
            {stories.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/story/${s.slug}`} className="text-slate-100 hover:text-terminal-amber">{short(s.title, 55)}</Link></td>
                <td className="text-right">{s.readers}</td><td className="text-right">{s.views}</td><td className="text-right">{s.avg ? fmtSec(s.avg) : "–"}</td>
                <td className="text-right">{s.stars ? `${s.stars.toFixed(1)}★` : "–"}</td><td className="text-right">{s.votes.length}</td>
                <td className="text-right">{s._count.comments}</td><td className="text-right">{s._count.quizAttempts}</td><td className="text-right">{s._count.unlocks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-terminal-amber">Signed-in readers</h2>
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Reader</th><th className="text-right">Visits</th><th className="text-right">Pages</th><th className="text-right">Time</th><th>Last seen</th></tr></thead>
          <tbody>
            {members.length === 0 && <tr><td colSpan={5} className="text-terminal-dim">No signed-in visits yet.</td></tr>}
            {members.map((m) => (
              <tr key={m.id}>
                <td><Link href={`/admin/visitors?user=${m.id}&days=${days}`} className="text-slate-100 hover:text-terminal-amber">{m.name ? `${m.name} · ` : ""}{m.email ?? m.phone}</Link></td>
                <td className="text-right">{m.visits}</td><td className="text-right">{m.views}</td><td className="text-right">{fmtSec(m.seconds)}</td>
                <td className="text-terminal-dim">{m.last ? time(m.last) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[11px] text-terminal-dim">Visits end after 30 minutes without a page view. Admin browsing and bots are not counted. Time on page is the time the tab was visible.</p>
    </div>
  );
}

async function UserDetail({ userId, since, days }: { userId: string; since: Date; days: number }) {
  const [user, views, acts] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, name: true, tokenBalance: true, createdAt: true } }),
    db.pageView.findMany({ where: { userId, createdAt: { gte: since } }, orderBy: { createdAt: "asc" } }),
    db.activity.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  if (!user) return <p className="text-terminal-dim">Reader not found.</p>;
  const sessions = new Map<string, PV[]>();
  for (const v of views) sessions.set(v.sessionId, [...(sessions.get(v.sessionId) ?? []), v]);
  const visits = [...sessions.values()].reverse();
  // Favorite stories: most time spent.
  const fav = new Map<string, { title: string; seconds: number; views: number }>();
  for (const v of views.filter((v) => v.path.startsWith("/story/"))) {
    const f = fav.get(v.path) ?? { title: v.title.replace(/ \| RALECHE$/, ""), seconds: 0, views: 0 };
    f.seconds += v.seconds; f.views++;
    fav.set(v.path, f);
  }
  const favorites = [...fav.entries()].sort((a, b) => b[1].seconds - a[1].seconds || b[1].views - a[1].views).slice(0, 8);

  return (
    <div>
      <Link href={`/admin/visitors?days=${days}`} className="font-mono text-[11px] uppercase tracking-widest text-terminal-dim hover:text-slate-100">← All visitors</Link>
      <PageTitle title={user.name || user.email || user.phone || "Reader"} sub={`${user.email ?? user.phone ?? ""} · ${user.tokenBalance} tokens · joined ${user.createdAt.toLocaleDateString()}`} />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="term-panel p-4">
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-terminal-amber">Favorite stories (most time)</h3>
          {favorites.length === 0 ? <p className="text-terminal-dim">No story views yet.</p> : (
            <table className="term-table"><tbody>{favorites.map(([path, f]) => <tr key={path}><td><Link href={path} className="text-slate-100 hover:text-terminal-amber">{short(f.title, 60)}</Link></td><td className="text-right">{fmtSec(f.seconds)}</td><td className="text-right">{f.views}×</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="term-panel p-4">
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-terminal-amber">What they did</h3>
          {acts.length === 0 ? <p className="text-terminal-dim">No activity yet.</p> : (
            <table className="term-table"><tbody>{acts.slice(0, 20).map((a) => <tr key={a.id}><td className="whitespace-nowrap text-terminal-dim">{time(a.createdAt)}</td><td><Badge>{a.kind}</Badge></td><td className="break-words">{short(a.detail, 90)}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>
      <h3 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-terminal-amber">Visits, newest first (landing → exit)</h3>
      <div className="space-y-3">
        {visits.length === 0 && <p className="text-terminal-dim">No visits in the last {days} days.</p>}
        {visits.map((s) => (
          <div key={s[0].sessionId} className="term-panel p-3">
            <p className="mb-2 text-[11px] text-terminal-dim">{time(s[0].createdAt)} · {s.length} page{s.length > 1 ? "s" : ""} · {fmtSec(s.reduce((n, v) => n + v.seconds, 0))}{s[0].country !== undefined ? ` · ${countryLabel(s[0].country)}` : ""}{` · via ${visitSource(s)}`}{s[0].referrer ? ` · from ${s[0].referrer}` : ""}</p>
            <ol className="space-y-1">
              {s.map((v, i) => (
                <li key={v.id} className="flex gap-2 text-[12px]">
                  <span className="w-14 shrink-0 text-terminal-dim">{i === 0 ? "LAND" : i === s.length - 1 ? "EXIT" : `${i + 1}`}</span>
                  <Link href={v.path} className="text-slate-100 hover:text-terminal-amber">{short(v.title.replace(/ \| RALECHE$/, "") || v.path, 70)}</Link>
                  <span className="ml-auto text-terminal-dim">{v.seconds ? fmtSec(v.seconds) : ""}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Every visit from one source (e.g. twitter): when, who, the page they landed on, how far they went. */
async function SourceDetail({ source, since, days }: { source: string; since: Date; days: number }) {
  const views: PV[] = await db.pageView.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, take: 100_000 });
  const sessions = new Map<string, PV[]>();
  for (const v of views) sessions.set(v.sessionId, [...(sessions.get(v.sessionId) ?? []), v]);
  const visits = [...sessions.values()].filter((s) => visitSource(s) === source).reverse();
  const landed = top(visits.map((s) => s[0]), (v) => v.path, 15);
  const sharerIds = [...new Set(visits.map((s) => s.find((v) => v.sharedBy)?.sharedBy).filter(Boolean) as string[])];
  const sharers = sharerIds.length ? await db.user.findMany({ where: { id: { in: sharerIds } }, select: { id: true, email: true, phone: true, name: true } }) : [];
  const titleOf = new Map(views.map((v) => [v.path, v.title.replace(/ \| RALECHE$/, "")]));
  return (
    <div>
      <Link href={`/admin/visitors?days=${days}`} className="font-mono text-[11px] uppercase tracking-widest text-terminal-dim hover:text-slate-100">← All visitors</Link>
      <PageTitle title={`Visits from ${source}`} sub={`Last ${days} days · ${visits.length} visit${visits.length === 1 ? "" : "s"} · ${new Set(visits.map((s) => s[0].visitorId)).size} visitors`} />
      <div className="mb-4 flex gap-3 font-mono text-[11px] uppercase tracking-widest">
        {[7, 30, 90].map((d) => <Link key={d} href={`/admin/visitors?source=${encodeURIComponent(source)}&days=${d}`} className={d === days ? "text-terminal-amber" : "text-terminal-dim hover:text-slate-100"}>{d} days</Link>)}
      </div>
      <div className="mb-6"><Table title="Pages they landed on" rows={landed.map(([p, n]) => [titleOf.get(p) || p, n])} /></div>
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>When</th><th>Visitor</th><th>Country</th><th>Landed on</th><th className="text-right">Pages</th><th className="text-right">Time</th><th>Shared by</th><th>Referrer</th></tr></thead>
          <tbody>
            {visits.length === 0 && <tr><td colSpan={8} className="text-terminal-dim">No visits from {source} in the last {days} days.</td></tr>}
            {visits.slice(0, 500).map((s) => (
              <tr key={s[0].sessionId}>
                <td className="whitespace-nowrap text-terminal-dim">{time(s[0].createdAt)}</td>
                <td className="whitespace-nowrap"><Link href={`/admin/visitors?visitor=${encodeURIComponent(s[0].visitorId)}&days=${days}`} className="text-slate-100 hover:text-terminal-amber">{visitorName(s[0].visitorId)}</Link></td>
                <td className="whitespace-nowrap">{countryLabel(s[0].country)}</td>
                <td className="max-w-[20rem] truncate" title={s[0].path}><Link href={s[0].path} className="hover:text-terminal-amber">{short(titleOf.get(s[0].path) || s[0].path, 55)}</Link></td>
                <td className="text-right">{s.length}</td><td className="text-right">{fmtSec(s.reduce((n, v) => n + v.seconds, 0))}</td>
                <td className="whitespace-nowrap">{(() => { const by = s.find((v) => v.sharedBy)?.sharedBy; const u = by ? sharers.find((x) => x.id === by) : null; return by ? <Link href={`/admin/visitors?user=${by}&days=${days}`} className="text-terminal-amber hover:text-slate-100">{u?.name || u?.email || u?.phone || "member"}</Link> : <span className="text-terminal-dim">–</span>; })()}</td>
                <td className="max-w-[14rem] truncate text-terminal-dim" title={s[0].referrer ?? ""}>{s[0].referrer ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
