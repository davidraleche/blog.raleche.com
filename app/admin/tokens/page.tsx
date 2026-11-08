import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { fmtDate } from "@/lib/utils";

export default async function Tokens() {
  const [txns, totals, outstanding] = await Promise.all([
    db.tokenTxn.findMany({ include: { user: { select: { email: true, phone: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.tokenTxn.groupBy({ by: ["reason"], _sum: { amount: true } }),
    db.user.aggregate({ _sum: { tokenBalance: true } }),
  ]);
  const sum = (reason: string) => totals.find((t) => t.reason === reason)?._sum.amount ?? 0;
  const tiles: [string, string][] = [
    ["Outstanding", (outstanding._sum.tokenBalance ?? 0).toLocaleString()],
    ["Bought", `${sum("purchase").toLocaleString()} · $${(sum("purchase") / 100).toFixed(2)}`],
    ["Wheel", sum("wheel").toLocaleString()],
    ["Polls + comments", (sum("poll") + sum("comment")).toLocaleString()],
    ["Spent on unlocks", Math.abs(sum("unlock")).toLocaleString()],
  ];
  return (
    <div>
      <PageTitle title="Tokens" sub="$1 = 100 tokens · every token change" />
      <div className="mb-6 grid gap-3 sm:grid-cols-5">
        {tiles.map(([k, v]) => (
          <div key={k} className="term-panel p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-terminal-dim">{k}</p><p className="mt-1 text-xl text-slate-100">{v}</p></div>
        ))}
      </div>
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Date</th><th>Member</th><th>Reason</th><th>Note</th><th className="text-right">Tokens</th></tr></thead>
          <tbody>
            {txns.length === 0 && <tr><td colSpan={5} className="text-terminal-dim">No token activity yet.</td></tr>}
            {txns.map((x) => (
              <tr key={x.id}>
                <td className="whitespace-nowrap text-terminal-dim">{fmtDate(x.createdAt)}</td>
                <td className="text-slate-100">{x.user.email ?? x.user.phone}</td>
                <td><Badge tone={x.amount >= 0 ? "up" : "down"}>{x.reason}</Badge></td>
                <td className="text-terminal-dim">{x.note}</td>
                <td className={`text-right font-semibold ${x.amount >= 0 ? "text-terminal-up" : "text-terminal-down"}`}>{x.amount >= 0 ? "+" : ""}{x.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
