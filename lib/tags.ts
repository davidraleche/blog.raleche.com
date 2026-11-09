import "server-only";
import { cache } from "react";
import { db } from "./db";
import { slugify } from "./utils";

/** A tag gets its own page once this many published stories share it; rarer tags stay plain labels so we don't publish thin pages. */
export const MIN_TAG_STORIES = 2;

export const tagSlug = (name: string) => slugify(name);
export const splitTags = (tags: string) => tags.split(",").map((t) => t.trim()).filter(Boolean);

const published = () => ({ status: "published", publishedAt: { lte: new Date() } });

/** Every tag with a page: slug → display name and story count. */
export const tagIndex = cache(async () => {
  const posts = await db.post.findMany({ where: published(), select: { tags: true } });
  const index = new Map<string, { name: string; count: number }>();
  for (const p of posts) {
    for (const name of new Set(splitTags(p.tags))) {
      const slug = tagSlug(name);
      if (!slug) continue;
      const e = index.get(slug) ?? { name, count: 0 };
      e.count++;
      index.set(slug, e);
    }
  }
  for (const [slug, e] of index) if (e.count < MIN_TAG_STORIES) index.delete(slug);
  return index;
});

export async function postsForTag(slug: string) {
  const tag = (await tagIndex()).get(slug);
  if (!tag) return null;
  const posts = await db.post.findMany({
    where: { ...published(), tags: { contains: tag.name.split(/\s+/)[0], mode: "insensitive" } },
    include: { category: true },
    orderBy: { publishedAt: "desc" },
  });
  return { name: tag.name, posts: posts.filter((p) => splitTags(p.tags).some((t) => tagSlug(t) === slug)) };
}
