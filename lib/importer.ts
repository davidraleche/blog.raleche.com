import TurndownService from "turndown";
import { db } from "./db";
import { readMinutes } from "./utils";

const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const meta = (html: string, prop: string) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i"));
  return m ? decode(m[1]) : "";
};

const CATEGORY_RULES: [string, RegExp][] = [
  ["Careers", /salary|career|negotiat/i],
  ["Startups", /startup|paul graham|y combinator|venture/i],
  ["Big Tech", /amazon|google|meta\b|apple|microsoft|palantir|airbnb|openai/i],
  ["Leadership", /leadership|management|founder|ceo/i],
  ["AI", /\bai\b|artificial intelligence|llm|model/i],
];

export function pickCategory(text: string) {
  return CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] ?? "AI";
}

/** Pull a section (h2 heading + content until the next h2) out of article HTML. */
function section(html: string, heading: RegExp) {
  const parts = html.split(/(?=<h2[\s>])/i);
  return parts.find((p) => heading.test(p.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "")) ?? "";
}

export async function listSourceArticles(source: string) {
  const xml = await (await fetch(`${source}/sitemap.xml`, { cache: "no-store" })).text();
  const slugs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => new URL(m[1]).pathname)
    .filter((p) => /^\/blog\/[^/]+$/.test(p))
    .map((p) => p.split("/").pop()!);
  return [...new Set(slugs)];
}

export async function fetchSourceArticle(source: string, slug: string) {
  const url = `${source}/blog/${slug}`;
  const html = await (await fetch(url, { cache: "no-store" })).text();
  const origin = new URL(meta(html, "og:url") || url).origin;
  const abs = (s: string) => s.replace(/(src|href)="\/(?!\/)/g, `$1="${origin}/`);

  const title = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? meta(html, "og:title"));
  const articleHtml = abs(html.match(/<article class="rc-article"[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? "");
  if (!articleHtml) throw new Error(`No article body found at ${url}`);

  const video = html.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]+)/)?.[1];
  let body = td.turndown(articleHtml);
  if (video) body = `> Watch the original interview: [YouTube](https://www.youtube.com/watch?v=${video})\n\n` + body;

  const shortVersion = section(articleHtml, /short version|key takeaways|tl;?dr/i);
  const actions = section(articleHtml, /what to do|do about|next steps|for (your|small) business|what it means/i);
  const executiveSummary = td.turndown(shortVersion + actions).trim();

  const tags = [...html.matchAll(/<meta property="article:tag" content="([^"]+)"/g)].map((m) => decode(m[1]));
  const cover = meta(html, "og:image");
  const published = meta(html, "article:published_time");

  return {
    slug,
    title,
    dek: meta(html, "description") || meta(html, "og:description"),
    body,
    executiveSummary,
    coverImage: cover ? abs(`src="${cover}"`).slice(5, -1) : null,
    tags: tags.join(", "),
    readMinutes: Number(html.match(/(\d+) min read/)?.[1]) || readMinutes(body),
    publishedAt: published ? new Date(published) : new Date(),
    sourceUrl: meta(html, "og:url") || url,
    category: pickCategory(`${title} ${tags.join(" ")}`),
  };
}

export async function importFromSource(source = process.env.IMPORT_SOURCE || "https://tts42.com") {
  const slugs = await listSourceArticles(source);
  let created = 0, updated = 0;
  const errors: string[] = [];
  for (const slug of slugs) {
    try {
      const a = await fetchSourceArticle(source, slug);
      const category = await db.category.upsert({
        where: { name: a.category },
        create: { name: a.category, slug: a.category.toLowerCase().replace(/\s+/g, "-") },
        update: {},
      });
      const data = {
        title: a.title, dek: a.dek, body: a.body, coverImage: a.coverImage, tags: a.tags,
        readMinutes: a.readMinutes, publishedAt: a.publishedAt, categoryId: category.id,
      };
      const existing = await db.post.findFirst({ where: { OR: [{ sourceUrl: a.sourceUrl }, { slug }] } });
      if (existing) {
        // Keep admin edits to the executive summary; only fill it if empty.
        await db.post.update({ where: { id: existing.id }, data: { ...data, executiveSummary: existing.executiveSummary || a.executiveSummary } });
        updated++;
      } else {
        await db.post.create({
          data: { ...data, slug, executiveSummary: a.executiveSummary, status: "published", source: "tts42", sourceUrl: a.sourceUrl, authorName: "Tech Team Strategy" },
        });
        created++;
      }
    } catch (e) {
      errors.push(`${slug}: ${(e as Error).message}`);
    }
  }
  // Feature the newest article if nothing is featured yet.
  if (!(await db.post.count({ where: { featured: true } }))) {
    const newest = await db.post.findFirst({ where: { status: "published" }, orderBy: { publishedAt: "desc" } });
    if (newest) await db.post.update({ where: { id: newest.id }, data: { featured: true } });
  }
  await db.importRun.create({ data: { source, created, updated, errors: errors.join("\n") } });
  return { created, updated, errors, total: slugs.length };
}
