import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { dashboardMetrics } from "@/lib/metrics";
import { AdminNav } from "@/components/admin/Nav";
import { Clock } from "@/components/admin/Clock";
import { signOut } from "@/app/actions/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Terminal", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const m = await dashboardMetrics();
  const tape = [
    ["MRR", `$${m.mrr.toFixed(2)}`, m.mrrChangePct],
    ["ARR", `$${m.arr.toLocaleString()}`, m.mrrChangePct],
    ["MEMBERS", String(m.members), m.signups.pct],
    ["USERS", String(m.users), m.signups.pct],
    ["NEWSLTR", String(m.subscribers), m.newsletter.pct],
    ["VIEWS.7D", String(m.views.cur), m.views.pct],
    ["CONV", `${m.conversion.toFixed(1)}%`, 0],
    ["ARPU", `$${m.arpu.toFixed(2)}`, 0],
    ["POSTS", String(m.publishedPosts), 0],
  ] as const;

  return (
    <div className="term min-h-screen">
      <div className="flex items-center justify-between border-b border-terminal-line bg-black px-4 py-2 font-mono text-[11px] uppercase tracking-widest">
        <Link href="/admin" className="flex items-center gap-2 font-semibold text-terminal-amber">
          <span className="bg-terminal-amber px-1.5 text-black">RLCH</span> Terminal
        </Link>
        <div className="flex items-center gap-5 text-slate-400">
          <span className="hidden items-center gap-1.5 sm:flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terminal-up" />Live</span>
          <span className="hidden md:inline"><Clock /></span>
          <Link href="/" className="hover:text-white">View site ↗</Link>
          <span className="hidden text-slate-500 lg:inline">{admin.email}</span>
          <form action={signOut}><button className="hover:text-terminal-down">Logout</button></form>
        </div>
      </div>
      <div className="overflow-hidden border-b border-terminal-line bg-terminal-panel py-1.5">
        <div className="ticker-track flex w-max gap-10 font-mono text-xs">
          {[...tape, ...tape].map(([k, v, pct], i) => (
            <span key={i} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-terminal-amber">{k}</span>
              <span className="tabular-nums text-white">{v}</span>
              <span className={pct >= 0 ? "text-terminal-up" : "text-terminal-down"}>{pct >= 0 ? "▲" : "▼"}{Math.abs(pct).toFixed(1)}%</span>
            </span>
          ))}
        </div>
      </div>
      <div className="grid lg:grid-cols-[220px_1fr]">
        <aside className="border-b border-terminal-line p-3 lg:min-h-[calc(100vh-70px)] lg:border-b-0 lg:border-r">
          <AdminNav />
        </aside>
        <main className="min-w-0 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
