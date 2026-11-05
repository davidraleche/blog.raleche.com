import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { absUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories] = await Promise.all([
    db.post.findMany({ where: { status: "published", publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true, coverImage: true }, orderBy: { publishedAt: "desc" } }),
    db.category.findMany({ select: { slug: true } }),
  ]);
  const latest = posts[0]?.updatedAt ?? new Date();
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") => ({ url: absUrl(path), lastModified: latest, changeFrequency, priority });
  return [
    page("/", 1, "daily"),
    page("/executive-summaries", 0.8, "daily"),
    page("/speakers", 0.7),
    page("/hosts", 0.7),
    page("/membership", 0.6, "monthly"),
    ...categories.map((c) => page(`/category/${c.slug}`, 0.7, "daily")),
    ...posts.map((p) => ({ url: absUrl(`/story/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.9, images: p.coverImage ? [p.coverImage] : undefined })),
    page("/privacy", 0.2, "monthly"),
    page("/terms", 0.2, "monthly"),
  ];
}
