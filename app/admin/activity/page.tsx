import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { setAdminAlerts } from "../actions";

const KINDS = ["comment", "vote", "spin", "quiz", "purchase", "unlock", "memo", "follow"] as const;
const TONE: Record<string, "up" | "down" | "amber" | "dim"> = { comment: "amber", vote: "up", spin: "amber", quiz: "up", purchase: "up", unlock: "up", follow: "dim" };
const time = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

export default async function Activity({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const startOfDay = new Date(new Date().toISOString().slice(0, 10));
  const [rows, today, alerts] = await Promise.all([
    db.activity.findMany({
      where: kind && (KINDS as readonly string[]).includes(kind) ? { kind } : {},
      include: { user: { select: { id: true, email: true, phone: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    db.activity.groupBy({ by: ["kind"], where: { createdAt: { gte: startOfDay } }, _count: true }),
    db.setting.findUnique({ where: { key: "adminAlerts" } }),
  ]);
  const posts = new Map((await db.post.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.postId).filter(Boolean) as string[])] } }, select: { id: true, title: true, slug: true } })).map((p) => [p.id, p]));
  const count = (k: string) => today.find((t) => t.kind === k)?._count ?? 0;
  const alertsOn = alerts?.value !== "off";

  return (
    <div>
      <PageTitle title="Activity" sub="What readers do, as it happens · times in Pacific" />
      <div className="mb-4 grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {KINDS.map((k) => (
          <Link key={k} href={kind === k ? "/admin/activity" : `/admin/activity?kind=${k}`} className={`term-panel p-3 ${kind === k ? "border-terminal-amber" : ""}`}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-terminal-dim">{k} today</p>
            <p className="mt-1 text-xl text-slate-100">{count(k)}</p>
          </Link>
        ))}
      </div>
      <form action={setAdminAlerts} className="term-panel mb-4 flex flex-wrap items-center gap-3 p-3">
        <input type="hidden" name="value" value={alertsOn ? "off" : "on"} />
        <span className="font-mono text-[11px] uppercase tracking-widest text-terminal-dim">Email alerts</span>
        <Badge tone={alertsOn ? "up" : "down"}>{alertsOn ? "On" : "Off"}</Badge>
        <button className="text-terminal-amber hover:underline">{alertsOn ? "Turn off" : "Turn on"}</button>
        <span className="text-terminal-dim">Comments, votes, spins, quizzes and purchases email you who did what, up to 40 a day (Resend&apos;s free plan sends 100 emails a day in total). Your own actions are not emailed.</span>
      </form>
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Story</th><th>Details</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-terminal-dim">No activity yet.</td></tr>}
            {rows.map((r) => {
              const p = r.postId ? posts.get(r.postId) : null;
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-terminal-dim">{time(r.createdAt)}</td>
                  <td>{r.user ? <Link href={`/admin/visitors?user=${r.user.id}`} className="text-slate-100 hover:text-terminal-amber">{r.user.name ? `${r.user.name} · ` : ""}{r.user.email ?? r.user.phone}</Link> : <span className="text-terminal-dim">Anonymous</span>}</td>
                  <td><Badge tone={TONE[r.kind] ?? "dim"}>{r.kind}</Badge></td>
                  <td>{p ? <Link href={`/story/${p.slug}`} className="hover:text-terminal-amber">{p.title.slice(0, 45)}</Link> : ""}</td>
                  <td className="max-w-md break-words">{r.detail}</td>
                  <td className="text-terminal-dim">{r.emailed ? "✉" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
