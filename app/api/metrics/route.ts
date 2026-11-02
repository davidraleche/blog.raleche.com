import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { dashboardMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

/** Read-only numbers for the tts42.com owner dashboard. Protected by the same shared secret as /api/import. */
export async function GET(req: Request) {
  const secret = process.env.IMPORT_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });
  const [m, subs, users] = await Promise.all([
    dashboardMetrics(),
    db.subscription.findMany({ include: { user: { select: { email: true, phone: true, name: true } }, plan: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.user.findMany({ select: { email: true, phone: true, name: true, createdAt: true, lastSeenAt: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return Response.json({
    ...m,
    subscriptions: subs.map((s) => ({ who: s.user.email || s.user.phone || s.user.name || "", plan: s.plan.name, priceCents: s.priceCents, status: s.status, at: s.createdAt })),
    recentUsers: users.map((u) => ({ who: u.email || u.phone || "", name: u.name ?? "", at: u.createdAt, lastSeenAt: u.lastSeenAt })),
  });
}
