import "server-only";
import { db } from "./db";
import { absUrl, SITE } from "./seo";
import type { Post, Category } from "@prisma/client";

export type PublicPost = Post & { category: Category | null };

export const publishedPosts = (where: object = {}, take?: number) =>
  db.post.findMany({ where: { status: "published", publishedAt: { lte: new Date() }, ...where }, include: { category: true }, orderBy: { publishedAt: "desc" }, take });

/** What anyone may read: the full body of free stories, a teaser of members-only ones. Executive summaries are never included. */
export function publicBody(post: Post) {
  if (!post.premium) return post.body;
  return `${post.body.split(/\n\n/).slice(0, 3).join("\n\n")}\n\n*Unlock the rest of this story with tokens: ${absUrl(`/story/${post.slug}`)}*`;
}

/** A clean Markdown copy of a story, for AI tools and readers that prefer plain text. */
export function storyMarkdown(post: PublicPost) {
  const meta = [
    `Source: ${absUrl(`/story/${post.slug}`)}`,
    post.publishedAt && `Published: ${post.publishedAt.toISOString().slice(0, 10)}`,
    `Author: ${post.authorName} (${SITE.name})`,
    post.category && `Section: ${post.category.name}`,
    post.speaker && `Speaker: ${post.speaker}`,
    post.host && `Host: ${post.host}${post.show ? `, ${post.show}` : ""}`,
    post.tags && `Tags: ${post.tags}`,
  ].filter(Boolean).map((l) => `- ${l}`).join("\n");
  const summaryNote = post.executiveSummary ? `\n\n> An executive summary of this story is available to members at ${absUrl(`/story/${post.slug}`)}.` : "";
  return `# ${post.title}\n\n${post.dek ? `${post.dek}\n\n` : ""}${meta}${summaryNote}\n\n---\n\n${publicBody(post)}\n`;
}
