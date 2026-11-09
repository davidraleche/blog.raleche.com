import TurndownService from "turndown";
import { db } from "./db";
import { readMinutes } from "./utils";
import { extractPeople } from "./people";

const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const meta = (html: string, prop: string) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i"));
  return m ? decode(m[1]) : "";
};

export const CATEGORIES = ["Save Money", "Mistakes to Avoid"] as const;
export const OLD_CATEGORIES = ["AI", "Big Tech", "Leadership", "Startups", "Careers", "Security"];

// [section, keywords, weight]: "mistake" words are rarer than money words, so they count double and win ties.
const CATEGORY_RULES: [(typeof CATEGORIES)[number], RegExp, number][] = [
  ["Save Money", /\b(save|saving|savings|cost|costs|cheap|cheaper|spend|spending|budget|salary|salaries|pay|paid|compensation|negotiat\w*|price|pricing|money|\$\d|margin|efficien\w*|fewer|lean|small teams?|wealth|equity|profit)\b/gi, 1],
  ["Mistakes to Avoid", /\b(mistakes?|avoid|don'?t|never|wrong|risks?|risky|danger\w*|warn\w*|fail\w*|myths?|traps?|pitfalls?|lessons?|rushing|bureaucra\w*|stop)\b/gi, 2],
];

/** The section whose keywords appear most often in the text, or null if none fit. */
export function pickCategory(text: string) {
  const scored = CATEGORY_RULES.map(([name, re, w]) => [name, (text.match(re)?.length ?? 0) * w] as const).sort((a, b) => b[1] - a[1] || (a[0] === "Mistakes to Avoid" ? -1 : 1));
  return scored[0][1] > 0 ? scored[0][0] : null;
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
    // Sections (Save Money, Mistakes to Avoid) were retired; imports no longer get one automatically.
    category: null as string | null,
    ...extractPeople({ tags: tags.join(", "), body }),
  };
}

export async function importFromSource(source = process.env.IMPORT_SOURCE || "https://tts42.com", only?: string) {
  const slugs = only ? [only] : await listSourceArticles(source);
  let created = 0, updated = 0;
  const postIds: string[] = [];
  const errors: string[] = [];
  for (const slug of slugs) {
    try {
      const a = await fetchSourceArticle(source, slug);
      const category = a.category
        ? await db.category.upsert({ where: { name: a.category }, create: { name: a.category, slug: a.category.toLowerCase().replace(/\s+/g, "-") }, update: {} })
        : null;
      const data = {
        title: a.title, dek: a.dek, body: a.body, coverImage: a.coverImage, tags: a.tags,
        readMinutes: a.readMinutes, publishedAt: a.publishedAt, categoryId: category?.id ?? null,
      };
      const people = { speaker: a.speaker, host: a.host, show: a.show };
      const existing = await db.post.findFirst({ where: { OR: [{ sourceUrl: a.sourceUrl }, { slug }] } });
      if (existing) {
        // Keep admin edits to the executive summary; only fill it if empty.
        // Keep admin edits to the people fields too.
        // Keep covers hosted on this site (replacements for the source's image).
        const ownCover = existing.coverImage?.startsWith("/") || (!!process.env.APP_URL && existing.coverImage?.startsWith(process.env.APP_URL));
        await db.post.update({
          where: { id: existing.id },
          data: { ...data, coverImage: ownCover ? existing.coverImage : data.coverImage, executiveSummary: existing.executiveSummary || a.executiveSummary, speaker: existing.speaker ?? a.speaker, host: existing.host ?? a.host, show: existing.show ?? a.show },
        });
        postIds.push(existing.id);
        updated++;
      } else {
        const made = await db.post.create({
          data: { ...data, ...people, slug, executiveSummary: a.executiveSummary, status: "published", source: "tts42", sourceUrl: a.sourceUrl, authorName: "Tech Team Strategy" },
        });
        postIds.push(made.id);
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
  return { created, updated, errors, total: slugs.length, postIds };
}

/** One-time switch from the old sections: re-tag every post into the new ones and remove the old sections. Also fills missing speakers/hosts. */
export async function migrateSections(force = false) {
  const posts = await db.post.findMany({ select: { id: true, title: true, dek: true, tags: true, body: true, executiveSummary: true, speaker: true, host: true, show: true } });
  const switching = force || (await db.category.count({ where: { name: { in: OLD_CATEGORIES } } })) > 0;
  const ids = Object.fromEntries((await db.category.findMany({ where: { name: { in: [...CATEGORIES] } } })).map((c) => [c.name, c.id]));
  for (const p of posts) {
    const people = extractPeople(p);
    const data: Record<string, string | null> = {};
    if (!p.speaker && people.speaker) data.speaker = people.speaker;
    if (!p.host && people.host) data.host = people.host;
    if (!p.show && people.show) data.show = people.show;
    if (switching) {
      const c = pickCategory(`${p.title} ${p.title} ${p.dek} ${p.tags} ${p.executiveSummary}`);
      data.categoryId = c ? ids[c] ?? null : null;
    }
    if (Object.keys(data).length) await db.post.update({ where: { id: p.id }, data });
  }
  if (switching) await db.category.deleteMany({ where: { name: { in: OLD_CATEGORIES } } });
  return { posts: posts.length, switched: switching };
}
