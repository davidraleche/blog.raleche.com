import { db } from "@/lib/db";
import { PageTitle, Flash } from "@/components/admin/ui";
import { runImport } from "../actions";

export default async function Import({ searchParams }: { searchParams: Promise<{ created?: string; updated?: string; errors?: string }> }) {
  const sp = await searchParams;
  const [runs, count] = await Promise.all([db.importRun.findMany({ orderBy: { createdAt: "desc" }, take: 20 }), db.post.count({ where: { source: "tts42" } })]);
  return (
    <div>
      <PageTitle title="Import from TTS42" sub={`Source: ${process.env.IMPORT_SOURCE || "https://tts42.com"} · ${count} articles synced`}>
        <form action={runImport}><button className="term-btn">▶ Sync now</button></form>
      </PageTitle>
      {sp.created !== undefined && <Flash>Sync complete: {sp.created} new, {sp.updated} updated, {sp.errors} errors.</Flash>}
      <p className="mb-4 max-w-3xl font-mono text-xs leading-relaxed text-slate-400">
        Reads the tts42.com sitemap, copies every /blog article (title, body, cover, tags, date) and builds the executive summary from its
        “The short version” and action sections. Re-syncing updates article text but never overwrites an executive summary you've edited.
      </p>
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Run</th><th className="text-right">New</th><th className="text-right">Updated</th><th>Errors</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="text-terminal-dim">{r.createdAt.toLocaleString()}</td>
                <td className="text-right tabular-nums text-terminal-up">{r.created}</td>
                <td className="text-right tabular-nums">{r.updated}</td>
                <td className="whitespace-pre-wrap text-terminal-down">{r.errors || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
