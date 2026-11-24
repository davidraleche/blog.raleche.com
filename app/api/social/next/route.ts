import { authorized, nextStory } from "@/lib/social";

export const dynamic = "force-dynamic";

/** For the daily posting routine: the story to post today (newest not yet posted everywhere), or {story: null}. */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json({ story: await nextStory() });
}
