import { db } from "@/lib/db";
import { storyMarkdown } from "@/lib/public-content";
import { absUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const post = await db.post.findUnique({ where: { slug: (await params).slug }, include: { category: true } });
  if (!post || post.status !== "published" || !post.publishedAt || post.publishedAt > new Date()) return new Response("Not found\n", { status: 404 });
  return new Response(storyMarkdown(post), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      Link: `<${absUrl(`/story/${post.slug}`)}>; rel="canonical"`,
    },
  });
}
