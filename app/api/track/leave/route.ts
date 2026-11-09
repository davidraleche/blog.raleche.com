import { cookies } from "next/headers";
import { db } from "@/lib/db";

/** Time spent on a page, sent with navigator.sendBeacon when the reader leaves it. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string; seconds?: number } | null;
  const visitorId = (await cookies()).get("vid")?.value;
  if (!body?.id || !visitorId || typeof body.seconds !== "number") return new Response(null, { status: 204 });
  const seconds = Math.max(0, Math.min(3600, Math.round(body.seconds)));
  // Only the visitor who made the page view can set its time.
  await db.pageView.updateMany({ where: { id: body.id, visitorId }, data: { seconds } }).catch(() => null);
  return new Response(null, { status: 204 });
}
