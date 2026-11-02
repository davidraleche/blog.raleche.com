import { db } from "@/lib/db";
import { GridCard } from "@/components/Cards";

export const metadata = { title: "Search" };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const posts = q
    ? await db.post.findMany({
        where: { status: "published", OR: [{ title: { contains: q, mode: "insensitive" } }, { dek: { contains: q, mode: "insensitive" } }, { tags: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] },
        include: { category: true }, orderBy: { publishedAt: "desc" }, take: 30,
      })
    : [];
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <form className="border-b-[3px] border-ink pb-4">
        <input name="q" defaultValue={q} autoFocus placeholder="Search" className="w-full bg-transparent font-display text-6xl font-bold uppercase outline-none placeholder:text-ink/20 sm:text-8xl" />
      </form>
      {q && <p className="kicker mt-6 text-ink/60">{posts.length} result{posts.length === 1 ? "" : "s"} for “{q}”</p>}
      <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{posts.map((p) => <GridCard key={p.id} post={p} />)}</div>
    </div>
  );
}
