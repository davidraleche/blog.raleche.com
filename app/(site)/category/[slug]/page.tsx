import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { localizeFields, localizePosts } from "@/lib/localize";
import { db } from "@/lib/db";
import { HeroCard, GridCard } from "@/components/Cards";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await db.category.findUnique({ where: { slug: (await params).slug } });
  if (!c) return {};
  const path = `/category/${c.slug}`;
  const description = `${c.name}: stories and executive summaries from interviews with tech leaders, on RALECHE.`;
  return { title: c.name, description, alternates: { canonical: path, types: { "application/rss+xml": `/feed.xml?category=${c.slug}` } }, openGraph: { url: path, title: c.name, description } };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const category = await db.category.findUnique({
    where: { slug: (await params).slug },
    include: { posts: { where: { status: "published" }, include: { category: true }, orderBy: { publishedAt: "desc" } } },
  });
  if (!category) {
    // Sections retired in Nov 2026 (AI, Big Tech, …) send old links to the homepage.
    if (["ai", "big-tech", "leadership", "startups", "careers", "security"].includes((await params).slug)) permanentRedirect("/");
    notFound();
  }
  const { locale, t } = await getI18n();
  const [[{ name }], posts] = await Promise.all([localizeFields(locale, [category], ["name"]), localizePosts(locale, category.posts)]);
  const [first, ...rest] = posts;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="hed border-b-[3px] border-ink pb-4 text-7xl sm:text-9xl">{name}</h1>
      {!first && <p className="py-16 font-serif text-xl text-ink/60">{t("noStoriesSection")}</p>}
      {first && <div className="py-8"><HeroCard post={first} /></div>}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{rest.map((p) => <GridCard key={p.id} post={p} />)}</div>
    </div>
  );
}
