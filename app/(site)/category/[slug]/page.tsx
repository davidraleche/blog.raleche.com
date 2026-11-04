import { notFound } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { localizeFields, localizePosts } from "@/lib/localize";
import { db } from "@/lib/db";
import { HeroCard, GridCard } from "@/components/Cards";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const category = await db.category.findUnique({
    where: { slug: (await params).slug },
    include: { posts: { where: { status: "published" }, include: { category: true }, orderBy: { publishedAt: "desc" } } },
  });
  if (!category) notFound();
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
