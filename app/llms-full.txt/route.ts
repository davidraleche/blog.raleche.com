import { publishedPosts, storyMarkdown } from "@/lib/public-content";
import { SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Every public story as Markdown in one file, for AI assistants. */
export async function GET() {
  const posts = await publishedPosts();
  const body = `# ${SITE.name}: all stories\n\n> ${SITE.description}\n\n${posts.map(storyMarkdown).join("\n\n---\n\n")}`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
