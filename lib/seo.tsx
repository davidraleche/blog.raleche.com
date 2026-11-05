import type { Post, Category } from "@prisma/client";

export const SITE = {
  name: "RALECHE",
  url: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  description: "Technology, AI and the people building what's next: interviews with tech leaders, distilled into executive summaries for busy decision-makers.",
  publisher: "Tech Team Strategy",
};

export const absUrl = (path = "/") => (/^https?:\/\//.test(path) ? path : `${SITE.url}${path.startsWith("/") ? "" : "/"}${path}`);

/** Crawlers and AI agents: always served the canonical English page. */
export const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|GPT|Claude|Anthropic|Perplexity|Google-Extended|Bytespider|CCBot|cohere|Amazonbot|Applebot|DuckAssist|meta-external|MistralAI|YouBot|Diffbot/i;

const organization = {
  "@type": "NewsMediaOrganization",
  "@id": `${SITE.url}/#organization`,
  name: SITE.name,
  url: SITE.url,
  logo: { "@type": "ImageObject", url: absUrl("/icon.svg"), width: 512, height: 512 },
};

export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        inLanguage: "en-US",
        publisher: { "@id": `${SITE.url}/#organization` },
        potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" },
      },
    ],
  };
}

type PostWithCategory = Post & { category: Category | null };

export function articleJsonLd(post: PostWithCategory) {
  const url = absUrl(`/story/${post.slug}`);
  const tags = post.tags.split(",").map((t) => t.trim()).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "@id": `${url}#article`,
        mainEntityOfPage: url,
        url,
        headline: post.title.slice(0, 110),
        description: post.dek || undefined,
        image: post.coverImage ? [post.coverImage] : undefined,
        datePublished: post.publishedAt?.toISOString(),
        dateModified: (post.updatedAt ?? post.publishedAt)?.toISOString(),
        author: { "@type": "Organization", name: post.authorName, url: SITE.url },
        publisher: { "@id": `${SITE.url}/#organization` },
        articleSection: post.category?.name,
        keywords: tags.length ? tags.join(", ") : undefined,
        wordCount: post.body.split(/\s+/).length,
        timeRequired: `PT${post.readMinutes}M`,
        inLanguage: "en-US",
        isAccessibleForFree: !post.premium,
        about: post.speaker ? { "@type": "Person", name: post.speaker } : undefined,
        mentions: post.host ? [{ "@type": "Person", name: post.host }] : undefined,
        isBasedOn: post.sourceUrl || undefined,
      },
      breadcrumbs([
        ["Home", "/"],
        ...(post.category ? [[post.category.name, `/category/${post.category.slug}`] as [string, string]] : []),
        [post.title, `/story/${post.slug}`],
      ]),
    ],
  };
}

export function breadcrumbs(items: [string, string][]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absUrl(path) })),
  };
}

/** Safe inline JSON-LD (escapes `<` so content can't close the script tag). */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
