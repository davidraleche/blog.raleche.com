import Link from "next/link";
import { db } from "@/lib/db";
import { HeroCard, StackCard, GridCard, NumberedList } from "@/components/Cards";
import { NewsletterForm } from "@/components/NewsletterForm";
import { getUser, activePlan } from "@/lib/auth";

const published = { status: "published", publishedAt: { lte: new Date() } };

export default async function Home() {
  const [posts, popular, categories, user] = await Promise.all([
    db.post.findMany({ where: published, include: { category: true }, orderBy: [{ featured: "desc" }, { publishedAt: "desc" }], take: 40 }),
    db.post.findMany({ where: published, include: { category: true }, orderBy: { views: "desc" }, take: 5 }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { posts: { where: published, include: { category: true }, orderBy: { publishedAt: "desc" }, take: 4 } } }),
    getUser(),
  ]);
  if (!posts.length) return <p className="mx-auto max-w-7xl px-4 py-20 font-serif text-xl">No stories yet.</p>;

  const [hero, ...rest] = posts;
  const side = rest.slice(0, 4);
  const grid = rest.slice(4, 10);
  const member = !!activePlan(user);

  return (
    <div className="mx-auto max-w-7xl px-4">
      <section className="grid gap-10 py-8 lg:grid-cols-[1fr_340px]">
        <HeroCard post={hero} />
        <aside>
          <h2 className="hed rule mb-4 pt-3 text-2xl">Most Recent</h2>
          {side.map((p) => <StackCard key={p.id} post={p} />)}
        </aside>
      </section>

      {!member && (
        <section className="my-10 grid items-center gap-6 bg-accent px-6 py-8 text-white md:grid-cols-[1fr_auto] md:px-10">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/80">Membership</p>
            <h2 className="hed mt-2 text-4xl md:text-5xl">Read the executive summary. Skip the noise.</h2>
            <p className="mt-2 font-serif text-lg text-white/90">Every story, distilled into the takeaways that matter. From $12/month.</p>
          </div>
          <Link href="/membership" className="btn bg-ink text-white hover:bg-white hover:text-ink">Become a member</Link>
        </section>
      )}

      <section className="grid gap-12 py-8 lg:grid-cols-[1fr_340px]">
        <div>
          <h2 className="hed rule pt-3 text-3xl">The Latest</h2>
          <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {(grid.length ? grid : rest).map((p) => <GridCard key={p.id} post={p} />)}
          </div>
        </div>
        <NumberedList title="Most Popular" posts={popular} />
      </section>

      <section className="my-12 bg-ink px-6 py-12 text-white md:px-12">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="kicker text-terminal-amber">Newsletter</p>
            <h2 className="hed mt-2 text-5xl">Get the briefing</h2>
            <p className="mt-3 font-serif text-lg text-white/70">The week's most important stories on AI, tech and leadership. Free, every week.</p>
          </div>
          <NewsletterForm dark source="home" />
        </div>
      </section>

      {categories.filter((c) => c.posts.length).map((c) => (
        <section key={c.id} className="py-8">
          <div className="rule flex items-baseline justify-between pt-3">
            <h2 className="hed text-3xl">{c.name}</h2>
            <Link href={`/category/${c.slug}`} className="kicker hover:underline">More {c.name} →</Link>
          </div>
          <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {c.posts.map((p) => <GridCard key={p.id} post={p} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
