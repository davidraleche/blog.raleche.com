import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { localizePosts } from "@/lib/localize";
import { HeroCard, GridCard } from "@/components/Cards";
import { postsForTag } from "@/lib/tags";
import { JsonLd, breadcrumbs, absUrl, SITE } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tag = await postsForTag(slug);
  if (!tag) return {};
  const path = `/tag/${slug}`;
  const title = `${tag.name}: stories and executive summaries`;
  const description = `${tag.posts.length} RALECHE stories about ${tag.name}, from interviews with tech leaders, founders and investors, each with an executive summary.`;
  return { title, description, alternates: { canonical: path }, openGraph: { url: path, title, description } };
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const tag = await postsForTag(slug);
  if (!tag) notFound();
  const { locale } = await getI18n();
  const posts = await localizePosts(locale, tag.posts);
  const [first, ...rest] = posts;
  const path = `/tag/${slug}`;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              "@id": `${absUrl(path)}#page`,
              url: absUrl(path),
              name: tag.name,
              isPartOf: { "@id": `${SITE.url}/#website` },
              about: { "@type": "Thing", name: tag.name },
              mainEntity: { "@type": "ItemList", itemListElement: tag.posts.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: absUrl(`/story/${p.slug}`), name: p.title })) },
            },
            breadcrumbs([["Home", "/"], [tag.name, path]]),
          ],
        }}
      />
      <p className="kicker">Topic</p>
      <h1 className="hed mt-2 border-b-[3px] border-ink pb-4 text-6xl sm:text-8xl">{tag.name}</h1>
      <p className="mt-4 font-serif text-xl text-ink/70">{tag.posts.length} stories</p>
      {first && <div className="py-8"><HeroCard post={first} /></div>}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{rest.map((p) => <GridCard key={p.id} post={p} />)}</div>
    </div>
  );
}
