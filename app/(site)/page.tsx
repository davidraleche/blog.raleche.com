import Link from "next/link";
import { db } from "@/lib/db";
import { HeroCard, StackCard, GridCard, NumberedList } from "@/components/Cards";
import { NewsletterForm } from "@/components/NewsletterForm";
import { AdSlot } from "@/components/Ads";
import { getUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { localizePosts, localizeFields } from "@/lib/localize";

export const metadata = { alternates: { canonical: "/" }, openGraph: { url: "/" } };

// A function, so "now" is the time of each request (a constant froze it at server start and hid stories published since).
const published = () => ({ status: "published", publishedAt: { lte: new Date() } });

export default async function Home() {
  const { locale, t } = await getI18n();
  const [rawPosts, rawPopular, rawCategories, user] = await Promise.all([
    db.post.findMany({ where: published(), include: { category: true }, orderBy: { publishedAt: "desc" }, take: 40 }), // newest story is the center (hero) story
    db.post.findMany({ where: published(), include: { category: true }, orderBy: { views: "desc" }, take: 5 }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { posts: { where: published(), include: { category: true }, orderBy: { publishedAt: "desc" }, take: 4 } } }),
    getUser(),
  ]);
  // One translation batch for every story on the page.
  const sections = rawCategories.filter((c) => c.posts.length);
  const all = await localizePosts(locale, [...rawPosts, ...rawPopular, ...sections.flatMap((c) => c.posts)]);
  const posts = all.slice(0, rawPosts.length);
  const popular = all.slice(rawPosts.length, rawPosts.length + rawPopular.length);
  let offset = rawPosts.length + rawPopular.length;
  const names = await localizeFields(locale, sections, ["name"]);
  const categories = sections.map((c, i) => {
    const p = all.slice(offset, offset + c.posts.length);
    offset += c.posts.length;
    return { ...c, name: names[i].name, posts: p };
  });
  if (!posts.length) return <p className="mx-auto max-w-7xl px-4 py-20 font-serif text-xl">{t("noStories")}</p>;

  const [hero, ...rest] = posts;
  const side = rest.slice(0, 4);
  const grid = rest.slice(4, 10);

  return (
    <div className="mx-auto max-w-7xl px-4">
      <h1 className="sr-only">RALECHE: technology, AI and leadership, from interviews with the people building what&apos;s next</h1>
      <section className="grid gap-10 py-8 lg:grid-cols-[1fr_340px]">
        <HeroCard post={hero} />
        <aside>
          <h2 className="hed rule mb-4 pt-3 text-2xl">{t("mostRecent")}</h2>
          {side.map((p) => <StackCard key={p.id} post={p} />)}
        </aside>
      </section>

      <section className="my-10 grid items-center gap-6 bg-accent px-6 py-8 text-white md:grid-cols-[1fr_auto] md:px-10">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/80">{t("tokenEconomy")}{user && ` · ${t("youHaveTokens", { n: user.tokenBalance })}`}</p>
          <h2 className="hed mt-2 text-4xl md:text-5xl">{t("promoTokensTitle")}</h2>
          <p className="mt-2 font-serif text-lg text-white/90">{t("promoTokensText")}</p>
        </div>
        <Link href="/store" className="btn bg-ink text-white hover:bg-white hover:text-ink">{t("getTokens")}</Link>
      </section>

      <section className="grid gap-12 py-8 lg:grid-cols-[1fr_340px]">
        <div>
          <h2 className="hed rule pt-3 text-3xl">{t("theLatest")}</h2>
          <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {(grid.length ? grid : rest).map((p) => <GridCard key={p.id} post={p} />)}
          </div>
        </div>
        <NumberedList title={t("mostPopular")} posts={popular} />
      </section>

      <AdSlot name="feed" />

      <section className="my-12 bg-ink px-6 py-12 text-white md:px-12">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="kicker text-terminal-amber">{t("newsletter")}</p>
            <h2 className="hed mt-2 text-5xl">{t("getTheBriefing")}</h2>
            <p className="mt-3 font-serif text-lg text-white/70">{t("briefingText")}</p>
          </div>
          <NewsletterForm dark source="home" />
        </div>
      </section>

      {categories.map((c) => (
        <section key={c.id} className="py-8">
          <div className="rule flex items-baseline justify-between pt-3">
            <h2 className="hed text-3xl">{c.name}</h2>
            <Link href={`/category/${c.slug}`} className="kicker hover:underline">{t("moreIn", { name: c.name })}</Link>
          </div>
          <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {c.posts.map((p) => <GridCard key={p.id} post={p} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
