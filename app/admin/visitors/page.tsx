import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";

type PV = { id: string; visitorId: string; sessionId: string; userId: string | null; path: string; title: string; referrer: string | null; landing: boolean; seconds: number; createdAt: Date };

const fmtSec = (s: number) => (s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);
const time = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
const short = (t: string, n = 60) => (t.length > n ? `${t.slice(0, n)}…` : t);

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

export default async function Visitors({ searchParams }: { searchParams: Promise<{ days?: string; user?: string }> }) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = new Date(Date.now() - days * 86400e3);

  if (sp.user) return <UserDetail userId={sp.user} since={since} days={days} />;

  const views: PV[] = await db.pageView.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, take: 100_000 });
  const sessions = new Map<string, PV[]>();
  for (const v of views) sessions.set(v.sessionId, [...(sessions.get(v.sessionId) ?? []), v]);
  const visits = [...sessions.values()];
  const landings = visits.map((s) => s[0]);
  const exits = visits.map((s) => s[s.length - 1]);
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

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Table title="Landing pages (where visits start)" rows={top(landings, (v) => v.path)} />
        <Table title="Exit pages (where visits end)" rows={top(exits, (v) => v.path)} />
        <Table title="Where visitors come from" rows={top(landings.filter((v) => v.referrer), (v) => v.referrer!.split("/")[0])} />
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
            <p className="mb-2 text-[11px] text-terminal-dim">{time(s[0].createdAt)} · {s.length} page{s.length > 1 ? "s" : ""} · {fmtSec(s.reduce((n, v) => n + v.seconds, 0))}{s[0].referrer ? ` · from ${s[0].referrer}` : ""}</p>
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
