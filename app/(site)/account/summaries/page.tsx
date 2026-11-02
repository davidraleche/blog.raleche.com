import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, canReadSummaries } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Executive summaries" };

export default async function Summaries({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const user = await requireUser("/account/summaries");
  const member = canReadSummaries(user);
  const term = q.trim();
  const posts = await db.post.findMany({
    where: {
      status: "published",
      publishedAt: { lte: new Date() },
      executiveSummary: { not: "" },
      ...(term ? { OR: [{ title: { contains: term, mode: "insensitive" } }, { executiveSummary: { contains: term, mode: "insensitive" } }] } : {}),
    },
    include: { category: true },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div>
      {!member && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 bg-accent px-6 py-5 text-white">
          <p className="font-display text-2xl font-bold uppercase">Unlock every executive summary</p>
          <Link href="/membership" className="btn bg-ink text-white hover:bg-white hover:text-ink">From $12/month</Link>
        </div>
      )}

      <form className="mb-8 flex gap-3">
        <input name="q" defaultValue={term} placeholder="Search summaries" className="input" />
        <button className="btn-dark shrink-0">Search</button>
      </form>

      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
        {posts.length} {posts.length === 1 ? "summary" : "summaries"}{term && <> for “{term}” · <Link href="/account/summaries" className="text-accent hover:underline">clear</Link></>}
      </p>

      <div className="border-t-[3px] border-ink">
        {posts.map((p, i) => (
          <details key={p.id} open={member && i === 0 && !term} className="group border-b border-ink/15">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5">
              <span>
                {p.category && <span className="kicker">{p.category.name}</span>}
                <span className="hed mt-1 block text-2xl group-hover:text-accent">{p.title}</span>
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-ink/50">{fmtDate(p.publishedAt)}</span>
              </span>
              <span className="mt-6 font-mono text-xl leading-none text-ink/40 group-open:rotate-45 transition">+</span>
            </summary>
            {member ? (
              <div className="pb-6">
                <div className="prose-article prose-base prose-h2:text-xl" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.executiveSummary) }} />
                <Link href={`/story/${p.slug}`} className="mt-4 inline-block font-mono text-[11px] uppercase tracking-widest text-accent hover:underline">Read the full story →</Link>
              </div>
            ) : (
              <p className="pb-6 font-serif text-ink/60">Members only. <Link href="/membership" className="text-accent hover:underline">Subscribe to read</Link>.</p>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}
