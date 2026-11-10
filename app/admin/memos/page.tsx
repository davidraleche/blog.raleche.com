import Link from "next/link";
import { db } from "@/lib/db";
import { memoListSelect } from "@/lib/memos";
import { MEMO_COST } from "@/lib/tokens";
import { PageTitle, Badge } from "@/components/admin/ui";
import { saveMemo, removeMemoFile, deleteMemo, importMemos } from "../memo-actions";

const ERRORS: Record<string, string> = {
  title: "A memo needs a title.",
  price: "The price must be a whole number of tokens.",
  type: "Upload a PDF file.",
  size: "The file is over 4.5 MB. Compress the PDF and try again.",
  bought: "Someone has already bought this memo, so it was hidden instead of deleted.",
  import: "Couldn't read the brief list. Try again later.",
};

const kb = (n: number | null) => (n ? `${Math.round(n / 1024).toLocaleString()} KB` : "");

function MemoForm({ memo, posts }: { memo?: Awaited<ReturnType<typeof load>>["memos"][number]; posts: { id: string; title: string }[] }) {
  return (
    <form action={saveMemo} className="grid gap-3 md:grid-cols-2">
      {memo && <input type="hidden" name="id" value={memo.id} />}
      <label className="block md:col-span-2"><span className="term-label">Title</span><input name="title" defaultValue={memo?.title} required className="term-input mt-1" /></label>
      <label className="block md:col-span-2"><span className="term-label">Summary (shown on the Buy Memo page)</span><textarea name="summary" rows={3} defaultValue={memo?.summary} className="term-input mt-1" /></label>
      <label className="block"><span className="term-label">Story</span>
        <select name="postId" defaultValue={memo?.postId ?? ""} className="term-input mt-1">
          <option value="">None</option>
          {posts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="term-label">Price (tokens)</span><input name="priceTokens" type="number" min={0} title="0 makes it a free sample anyone can read" defaultValue={memo?.priceTokens ?? MEMO_COST} className="term-input mt-1" /></label>
        <label className="block"><span className="term-label">Order</span><input name="sortOrder" type="number" defaultValue={memo?.sortOrder ?? 0} className="term-input mt-1" /></label>
      </div>
      <label className="block"><span className="term-label">{memo?.fileName ? "Replace PDF" : "PDF file"} (max 4.5 MB)</span><input name="file" type="file" accept="application/pdf" className="term-input mt-1" /></label>
      <label className="flex items-center gap-2 self-end pb-2 font-mono text-xs text-slate-300"><input name="active" type="checkbox" defaultChecked={memo?.active ?? true} /> On sale</label>
      <div className="flex flex-wrap gap-4 md:col-span-2">
        <button className="term-btn">{memo ? "Save" : "Add memo"}</button>
      </div>
    </form>
  );
}

async function load() {
  const [memos, posts, sales] = await Promise.all([
    db.memo.findMany({ select: memoListSelect, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    db.post.findMany({ where: { status: "published" }, select: { id: true, title: true }, orderBy: { publishedAt: "desc" } }),
    db.memoPurchase.groupBy({ by: ["memoId"], _count: true, _sum: { tokens: true } }),
  ]);
  return { memos, posts, sales };
}

export default async function Memos({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; imported?: string; deleted?: string }> }) {
  const sp = await searchParams;
  const { memos, posts, sales } = await load();
  const saleOf = (id: string) => sales.find((s) => s.memoId === id);

  return (
    <div>
      <PageTitle title="Memos" sub={`In-depth PDF memos sold for tokens · default ${MEMO_COST} tokens`}>
        <form action={importMemos}><button className="term-btn-ghost">Import brief list</button></form>
      </PageTitle>
      {sp.error && <p className="term-panel mb-4 p-3 text-terminal-down">{ERRORS[sp.error] ?? sp.error}</p>}
      {sp.saved && <p className="term-panel mb-4 p-3 text-terminal-up">Saved.</p>}
      {sp.deleted && <p className="term-panel mb-4 p-3 text-terminal-up">Deleted.</p>}
      {sp.imported !== undefined && <p className="term-panel mb-4 p-3 text-terminal-up">{sp.imported} new memo{sp.imported === "1" ? "" : "s"} added from the brief list. Upload a PDF for each one to put it on sale.</p>}

      <div className="space-y-3">
        {memos.length === 0 && <p className="term-panel p-4 text-terminal-dim">No memos yet. Add one below, or use “Import brief list”.</p>}
        {memos.map((m) => {
          const s = saleOf(m.id);
          return (
            <details key={m.id} open={sp.saved === m.id} className="term-panel p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="text-slate-100">{m.title}</span>
                {!m.fileSize ? <Badge tone="down">No PDF</Badge> : m.active ? <Badge tone="up">{m.priceTokens === 0 ? "Free sample" : `On sale · ${m.priceTokens} tokens`}</Badge> : <Badge>Hidden</Badge>}
                <span className="font-mono text-[10px] text-terminal-dim">{s ? `${s._count} sold · ${(s._sum.tokens ?? 0).toLocaleString()} tokens` : "0 sold"}</span>
              </summary>
              <div className="mt-4">
                <MemoForm memo={m} posts={posts} />
                <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-terminal-line pt-3 font-mono text-[11px]">
                  {m.fileSize ? (
                    <>
                      <a href={`/memos/${m.id}/file`} target="_blank" rel="noopener" className="text-terminal-amber hover:underline">Open PDF ({kb(m.fileSize)})</a>
                      <form action={removeMemoFile}><input type="hidden" name="id" value={m.id} /><button className="text-terminal-dim hover:underline">Remove PDF</button></form>
                    </>
                  ) : <span className="text-terminal-dim">Upload a PDF to put this memo on sale.</span>}
                  {m.post && <Link href={`/story/${m.post.slug}`} className="text-terminal-dim hover:underline">Story ↗</Link>}
                  <form action={deleteMemo} className="ml-auto"><input type="hidden" name="id" value={m.id} /><button className="text-terminal-down hover:underline">Delete</button></form>
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <h2 className="mb-2 mt-8 font-mono text-xs uppercase tracking-widest text-terminal-amber">Add a memo</h2>
      <div className="term-panel p-4"><MemoForm posts={posts} /></div>
    </div>
  );
}
