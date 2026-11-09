import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { saveAmazonTag, saveBook, saveArticleMentions, reextractMentions } from "../actions";
import { amazonTag, amazonUrl, loadMentions } from "@/lib/books";

const ERRORS: Record<string, string> = {
  asin: "An ASIN is 10 letters or digits, like B0CX23V2ZK (it's in the Amazon product URL after /dp/).",
  cover: "The cover URL must start with https://.",
  json: "That isn't valid JSON.",
  shape: "Each book needs title, author, who and relation (recommends, reading, influenced, wrote); each person needs name, who and stance (admires, criticizes).",
};

export default async function Books({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; post?: string }> }) {
  const sp = await searchParams;
  const [tag, books, posts] = await Promise.all([
    amazonTag(),
    db.book.findMany({ include: { _count: { select: { mentions: true } } }, orderBy: { title: "asc" } }),
    db.post.findMany({ where: { status: "published" }, select: { id: true, slug: true, title: true, mentionsAt: true, _count: { select: { bookMentions: true, personMentions: true } } }, orderBy: { publishedAt: "desc" } }),
  ]);
  const mentions = await Promise.all(posts.map((p) => loadMentions(p.id)));

  return (
    <div>
      <PageTitle title="Books" sub="Books and people from each interview · Amazon affiliate links" />
      {sp.error && <p className="term-panel mb-4 p-3 text-terminal-down">Not saved: {ERRORS[sp.error] ?? sp.error}</p>}

      <form action={saveAmazonTag} className="term-panel mb-6 flex flex-wrap items-center gap-3 p-4">
        <span className="font-mono text-[11px] uppercase tracking-widest text-terminal-dim">Amazon Associates tag</span>
        <input name="tag" defaultValue={tag ?? ""} placeholder="yourname-20" className="term-input w-48" />
        <button className="text-terminal-up hover:underline">Save</button>
        <span className="text-terminal-dim">{tag ? "Every Buy on Amazon link carries this tag." : "Not set: links work but earn no commission."}</span>
      </form>

      <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-terminal-amber">Books ({books.length})</h2>
      <div className="term-panel mb-8 overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Book</th><th>Mentions</th><th>Amazon product (ASIN) and cover image</th><th>Link</th></tr></thead>
          <tbody>
            {books.length === 0 && <tr><td colSpan={4} className="text-terminal-dim">No books yet.</td></tr>}
            {books.map((b) => (
              <tr key={b.id}>
                <td><div className="text-slate-100">{b.title}</div><div className="text-[10px] text-terminal-dim">{b.author}</div></td>
                <td>{b._count.mentions}</td>
                <td>
                  <form action={saveBook} className="flex flex-wrap gap-1">
                    <input type="hidden" name="id" value={b.id} />
                    <input name="asin" defaultValue={b.asin ?? ""} placeholder="ASIN" className="term-input w-28 py-1 text-[11px]" />
                    <input name="coverUrl" defaultValue={b.coverUrl ?? ""} placeholder="https://… cover image" className="term-input w-56 py-1 text-[11px]" />
                    <button className="text-terminal-up hover:underline">Save</button>
                  </form>
                </td>
                <td><a href={amazonUrl(b, tag)} target="_blank" rel="noopener" className="text-terminal-amber hover:underline">{b.asin ? "Product" : "Search"} ↗</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="articles" className="mb-2 font-mono text-xs uppercase tracking-widest text-terminal-amber">Per article</h2>
      <div className="space-y-3">
        {posts.map((p, i) => (
          <details key={p.id} open={sp.post === p.id} className="term-panel p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="text-slate-100">{p.title}</span>
              {p.mentionsAt ? <Badge tone="up">{p._count.bookMentions} books · {p._count.personMentions} people</Badge> : <Badge tone="amber">Not extracted</Badge>}
              {sp.saved === p.id && <Badge tone="amber">Saved</Badge>}
            </summary>
            <form action={saveArticleMentions} className="mt-3">
              <input type="hidden" name="postId" value={p.id} />
              <textarea name="json" rows={10} className="term-input w-full font-mono text-[11px]" defaultValue={JSON.stringify(mentions[i], null, 2)} />
              <p className="mt-1 text-[10px] text-terminal-dim">books: title, author, who, relation (recommends · reading · influenced · wrote), note · people: name, who, stance (admires · criticizes), note</p>
              <div className="mt-2 flex gap-4">
                <button className="text-terminal-up hover:underline">Save</button>
                <button formAction={reextractMentions} className="text-terminal-amber hover:underline">Extract with AI</button>
                <Link href={`/story/${p.slug}#books`} className="text-terminal-dim hover:underline">View on site</Link>
              </div>
            </form>
          </details>
        ))}
      </div>
    </div>
  );
}
