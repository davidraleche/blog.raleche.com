import { publishedPosts, publicBody } from "@/lib/public-content";
import { renderMarkdown } from "@/lib/markdown";
import { SITE, absUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(req: Request) {
  const category = new URL(req.url).searchParams.get("category");
  const posts = await publishedPosts(category ? { category: { slug: category } } : {}, 50);
  const items = posts.map((p) => {
    const url = absUrl(`/story/${p.slug}`);
    return `<item>
<title>${esc(p.title)}</title>
<link>${url}</link>
<guid isPermaLink="true">${url}</guid>
<pubDate>${(p.publishedAt ?? p.createdAt).toUTCString()}</pubDate>
<dc:creator>${esc(p.authorName)}</dc:creator>
${p.category ? `<category>${esc(p.category.name)}</category>` : ""}
<description>${cdata(p.dek)}</description>
<content:encoded>${cdata(renderMarkdown(publicBody(p)))}</content:encoded>
${p.coverImage ? `<media:content url="${esc(p.coverImage)}" medium="image" width="1200" height="630"/>` : ""}
</item>`;
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${SITE.name}</title>
<link>${SITE.url}</link>
<description>${esc(SITE.description)}</description>
<language>en-us</language>
<atom:link href="${esc(absUrl(`/feed.xml${category ? `?category=${encodeURIComponent(category)}` : ""}`))}" rel="self" type="application/rss+xml"/>
${posts[0]?.publishedAt ? `<lastBuildDate>${posts[0].publishedAt.toUTCString()}</lastBuildDate>` : ""}
${items}
</channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
