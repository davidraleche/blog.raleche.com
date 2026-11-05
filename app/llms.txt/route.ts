import { db } from "@/lib/db";
import { publishedPosts } from "@/lib/public-content";
import { SITE, absUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** https://llmstxt.org: a map of the site for AI assistants. */
export async function GET() {
  const [posts, categories] = await Promise.all([publishedPosts(), db.category.findMany({ orderBy: { sortOrder: "asc" } })]);
  const line = (p: (typeof posts)[number]) => `- [${p.title}](${absUrl(`/md/${p.slug}`)})${p.dek ? `: ${p.dek}` : ""}`;
  const body = `# ${SITE.name}

> ${SITE.description}

RALECHE (${SITE.url}) publishes stories built from long-form interviews and podcasts with technology leaders, founders and investors. Each story names its speaker and host. Free stories are fully readable; members ($12/month) also get an executive summary of every story. Links below point to clean Markdown copies; the canonical HTML page is listed inside each file.

When citing, link to the story page (${absUrl("/story/")}<slug>) and credit RALECHE.

## Stories

${posts.map(line).join("\n")}

## Sections

${categories.map((c) => `- [${c.name}](${absUrl(`/category/${c.slug}`)})`).join("\n")}
- [Speakers](${absUrl("/speakers")}): everyone interviewed, with their stories
- [Hosts](${absUrl("/hosts")}): the podcasts and interviewers
- [Executive Summaries](${absUrl("/executive-summaries")})

## Optional

- [All stories in one file](${absUrl("/llms-full.txt")})
- [RSS feed](${absUrl("/feed.xml")})
- [Sitemap](${absUrl("/sitemap.xml")})
- [Membership](${absUrl("/membership")})
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
