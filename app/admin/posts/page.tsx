import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { quickPostUpdate } from "../actions";
import { fmtDate } from "@/lib/utils";

export default async function Posts({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "" } = await searchParams;
  const posts = await db.post.findMany({
    where: { ...(status ? { status } : {}), ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { tags: { contains: q, mode: "insensitive" } }] } : {}) },
    include: { category: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  const tone = { published: "up", draft: "dim", scheduled: "amber" } as const;

  return (
    <div>
      <PageTitle title="Posts" sub={`${posts.length} records`}>
        <Link href="/admin/posts/new" className="term-btn">+ New post</Link>
      </PageTitle>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search title or tag…" className="term-input max-w-xs" />
        <select name="status" defaultValue={status} className="term-input w-40">
          <option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option>
        </select>
        <button className="term-btn-ghost">Filter</button>
      </form>
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Title</th><th>Section</th><th>Status</th><th>Summary</th><th>Date</th><th className="text-right">Views</th><th></th></tr></thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td className="max-w-[380px]">
                  <Link href={`/admin/posts/${p.id}`} className="block truncate text-slate-100 hover:text-terminal-amber">{p.featured && <span className="text-terminal-amber">★ </span>}{p.title}</Link>
                  <span className="text-[10px] text-terminal-dim">/{p.slug}{p.source && ` · ${p.source}`}{p.premium && " · premium"}</span>
                </td>
                <td className="text-terminal-dim">{p.category?.name ?? "—"}</td>
                <td><Badge tone={tone[p.status as keyof typeof tone] ?? "dim"}>{p.status}</Badge></td>
                <td>{p.executiveSummary ? <span className="text-terminal-up">✓</span> : <span className="text-terminal-down">✗</span>}</td>
                <td className="whitespace-nowrap text-terminal-dim">{fmtDate(p.publishedAt)}</td>
                <td className="text-right tabular-nums">{p.views}</td>
                <td className="whitespace-nowrap text-right">
                  <form action={quickPostUpdate} className="inline">
                    <input type="hidden" name="id" value={p.id} /><input type="hidden" name="field" value="status" />
                    <input type="hidden" name="value" value={p.status === "published" ? "draft" : "published"} />
                    <button className="mr-3 text-terminal-dim hover:text-terminal-amber">{p.status === "published" ? "Unpublish" : "Publish"}</button>
                  </form>
                  {!p.featured && (
                    <form action={quickPostUpdate} className="inline">
                      <input type="hidden" name="id" value={p.id} /><input type="hidden" name="field" value="featured" />
                      <button className="mr-3 text-terminal-dim hover:text-terminal-amber">Feature</button>
                    </form>
                  )}
                  <Link href={`/story/${p.slug}`} target="_blank" className="text-terminal-dim hover:text-white">View ↗</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
