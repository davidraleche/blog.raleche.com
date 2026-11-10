import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { countryLabel } from "@/lib/geo";
import { visitorName } from "@/lib/visitor-name";

const fmtSec = (s: number) => (s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);
const time = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/Los_Angeles" });
const clock = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/Los_Angeles" });
const short = (t: string, n = 80) => (t.length > n ? `${t.slice(0, n)}…` : t);

const KIND_LABEL: Record<string, string> = { click: "click", spin_quote: "spin", spin_daily: "spin", quiz: "quiz", vocab: "vocabulary", quote_game: "quotes", leave: "left" };

type Step =
  | { type: "page"; at: Date; path: string; title: string; seconds: number; landing: boolean; referrer: string | null }
  | { type: "event"; at: Date; kind: string; detail: string; correct: boolean | null; amount: number | null };

/** One visitor (signed in or not): every visit, and inside each one every page and action in order, ending with where they left. */
export async function VisitorDetail({ visitorId, days }: { visitorId: string; days: number }) {
  const [views, events] = await Promise.all([
    db.pageView.findMany({ where: { visitorId }, orderBy: { createdAt: "asc" }, take: 5000 }),
    db.visitorEvent.findMany({ where: { visitorId }, orderBy: { createdAt: "asc" }, take: 10000 }),
  ]);
  const name = visitorName(visitorId);
  if (!views.length && !events.length) return <p className="text-terminal-dim">No history for {name}.</p>;
  const userIds = [...new Set([...views, ...events].map((v) => v.userId).filter(Boolean) as string[])];
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, phone: true, name: true } }) : [];

  // Group by visit. Events carry the visit id; older ones without it go into the visit they fall inside.
  const visits = new Map<string, { start: Date; steps: Step[]; country: string | null; referrer: string | null }>();
  for (const v of views) {
    const s = visits.get(v.sessionId) ?? { start: v.createdAt, steps: [], country: v.country, referrer: v.referrer };
    s.steps.push({ type: "page", at: v.createdAt, path: v.path, title: v.title, seconds: v.seconds, landing: v.landing, referrer: v.referrer });
    visits.set(v.sessionId, s);
  }
  for (const e of events) {
    const key = e.sessionId && visits.has(e.sessionId) ? e.sessionId : [...visits.entries()].filter(([, s]) => s.start <= e.createdAt).at(-1)?.[0] ?? `solo-${e.id}`;
    const s = visits.get(key) ?? { start: e.createdAt, steps: [], country: null, referrer: null };
    s.steps.push({ type: "event", at: e.createdAt, kind: e.kind, detail: e.detail, correct: e.correct, amount: e.amount });
    visits.set(key, s);
  }
  const list = [...visits.values()].map((s) => ({ ...s, steps: s.steps.sort((a, b) => a.at.getTime() - b.at.getTime()) })).sort((a, b) => b.start.getTime() - a.start.getTime());

  const answers = events.filter((e) => e.correct !== null);
  const won = events.reduce((n, e) => n + (e.amount ?? 0), 0);
  const spins = events.filter((e) => e.kind.startsWith("spin")).length;
  const last = list[0];
  const lastPage = last?.steps.filter((s) => s.type === "page").at(-1) as Extract<Step, { type: "page" }> | undefined;

  return (
    <div>
      <Link href={`/admin/visitors?days=${days}`} className="font-mono text-[11px] uppercase tracking-widest text-terminal-dim hover:text-slate-100">← All visitors</Link>
      <PageTitle
        title={name}
        sub={`${users.length ? `Signed in as ${users.map((u) => u.name || u.email || u.phone).join(", ")} · ` : "Never signed in · "}${countryLabel(views[0]?.country ?? null)} · first seen ${time(views[0]?.createdAt ?? events[0].createdAt)}`}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Visits", `${list.length}${list.length > 1 ? ` (came back ${list.length - 1}×)` : ""}`],
          ["Pages viewed", views.length],
          ["Time on site", fmtSec(views.reduce((n, v) => n + v.seconds, 0))],
          ["Spins", spins],
          ["Answers right / wrong", `${answers.filter((a) => a.correct).length} / ${answers.filter((a) => !a.correct).length}`],
          ["Tokens won", won],
        ].map(([k, v]) => (
          <div key={k as string} className="term-panel p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-terminal-dim">{k}</p><p className="mt-1 text-lg text-slate-100">{v}</p></div>
        ))}
      </div>
      {lastPage && <p className="mb-4 text-[12px] text-terminal-dim">Last left the site from <Link href={lastPage.path} className="text-slate-100 hover:text-terminal-amber">{lastPage.path}</Link> on {time(lastPage.at)}.</p>}

      <h3 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-terminal-amber">Visits, newest first: every page and action in order</h3>
      <div className="space-y-3">
        {list.map((s, n) => {
          const pages = s.steps.filter((x) => x.type === "page");
          const exitAt = pages.at(-1);
          return (
            <div key={s.start.toISOString() + n} className="term-panel p-3">
              <p className="mb-2 text-[11px] text-terminal-dim">
                Visit #{list.length - n} · {time(s.start)} · {pages.length} page{pages.length === 1 ? "" : "s"} · {fmtSec(pages.reduce((t, p) => t + (p.type === "page" ? p.seconds : 0), 0))}
                {s.country ? ` · ${countryLabel(s.country)}` : ""}{s.referrer ? ` · from ${s.referrer}` : ""}
              </p>
              <ol className="space-y-1">
                {s.steps.map((x, i) => (
                  <li key={i} className="flex gap-2 text-[12px]">
                    <span className="w-20 shrink-0 text-terminal-dim">{clock(x.at)}</span>
                    {x.type === "page" ? (
                      <>
                        <span className="w-12 shrink-0 font-mono text-[10px] uppercase text-terminal-amber">{x.landing ? "land" : x === exitAt ? "exit" : "page"}</span>
                        <Link href={x.path} className="text-slate-100 hover:text-terminal-amber">{short(x.title.replace(/ \| RALECHE$/, "") || x.path, 70)}</Link>
                        <span className="text-terminal-dim">{x.path}</span>
                        <span className="ml-auto text-terminal-dim">{x.seconds ? fmtSec(x.seconds) : ""}</span>
                      </>
                    ) : (
                      <>
                        <span className="w-12 shrink-0"><Badge tone={x.correct === true ? "up" : x.correct === false ? "down" : x.amount ? "amber" : undefined}>{KIND_LABEL[x.kind] ?? x.kind}</Badge></span>
                        <span className={`break-words ${x.kind === "click" || x.kind === "leave" ? "text-terminal-dim" : "text-slate-100"}`}>{short(x.detail, 260)}</span>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}
