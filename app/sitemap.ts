import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { absUrl } from "@/lib/seo";
import { tagIndex } from "@/lib/tags";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, tags] = await Promise.all([
    db.post.findMany({ where: { status: "published", publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true, coverImage: true }, orderBy: { publishedAt: "desc" } }),
    db.category.findMany({ select: { slug: true } }),
    tagIndex(),
  ]);
  const latest = posts[0]?.updatedAt ?? new Date();
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") => ({ url: absUrl(path), lastModified: latest, changeFrequency, priority });
  return [
    page("/", 1, "daily"),
    page("/memos", 0.8, "daily"),
    page("/speakers", 0.7),
    page("/hosts", 0.7),
    page("/store", 0.6, "monthly"),
    page("/play", 0.7, "daily"),
    page("/vocabulary", 0.6, "daily"),
    page("/vocabulary/words", 0.6, "weekly"),
    page("/quotes", 0.6, "daily"),
    page("/books", 0.7, "weekly"),
    ...categories.map((c) => page(`/category/${c.slug}`, 0.7, "daily")),
    ...posts.map((p) => ({ url: absUrl(`/story/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.9, images: p.coverImage ? [p.coverImage] : undefined })),
    ...[...tags.keys()].map((slug) => page(`/tag/${slug}`, 0.6)),
    page("/privacy", 0.2, "monthly"),
    page("/terms", 0.2, "monthly"),
  ];
}
