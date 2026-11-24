import { authorized, postStory, type PostRequest } from "@/lib/social";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** For the daily posting routine: post the texts it wrote for one story to WordPress, X and TikTok. */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as PostRequest | null;
  if (!body?.slug) return Response.json({ error: "slug required" }, { status: 400 });
  try {
    return Response.json({ slug: body.slug, results: await postStory(body) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
