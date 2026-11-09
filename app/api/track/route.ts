import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BOT_UA } from "@/lib/seo";

const VISITOR = "vid"; // first-party visitor id, 1 year
const VISIT = "vsid"; // current visit; ends after 30 minutes without a page view
const VISIT_MS = 30 * 60e3;

/**
 * Page-view beacon. Records every page view (first page of a visit = landing page; the last one = exit page),
 * linked to the member when signed in, and forwards signed-in visits to the tts42 admin log as before.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { path?: string; title?: string; referrer?: string } | null;
  if (!body?.path || !body.path.startsWith("/") || body.path.length > 500) return Response.json({ error: "path required" }, { status: 400 });
  const ua = (await headers()).get("user-agent") ?? "";
  // Crawlers aren't counted. Real browsers that mention an app name (e.g. "Claude/4.x Chrome/…") still are.
  const realBrowser = /Mozilla\/5\.0 .*(Chrome|Safari|Firefox)\/[\d.]+/.test(ua) && !/bot\b|crawler|spider/i.test(ua);
  if (BOT_UA.test(ua) && !realBrowser) return Response.json({ ok: true });

  const [user, jar] = await Promise.all([getUser(), cookies()]);
  let id: string | null = null;
  if (user?.role !== "ADMIN") {
    const secure = process.env.NODE_ENV === "production";
    let visitorId = jar.get(VISITOR)?.value;
    if (!visitorId || !/^[\w-]{10,40}$/.test(visitorId)) {
      visitorId = crypto.randomBytes(12).toString("base64url");
      jar.set(VISITOR, visitorId, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 365 * 86400 });
    }
    let sessionId = jar.get(VISIT)?.value;
    const landing = !sessionId || !/^[\w-]{10,40}$/.test(sessionId);
    if (landing) sessionId = crypto.randomBytes(12).toString("base64url");
    jar.set(VISIT, sessionId!, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: VISIT_MS / 1000 });

    // Only keep an outside referrer (where the visit came from), not our own pages.
    let referrer: string | null = null;
    try {
      const r = body.referrer ? new URL(body.referrer) : null;
      if (r && !/(^|\.)raleche\.com$|^localhost$/.test(r.hostname)) referrer = `${r.hostname}${r.pathname}`.slice(0, 300);
    } catch {}

    const pv = await db.pageView.create({
      data: { visitorId, sessionId: sessionId!, userId: user?.id ?? null, path: body.path, title: (body.title ?? "").slice(0, 200), referrer, landing },
    });
    id = pv.id;
  }

  // Signed-in visits are also forwarded to the tts42 admin log.
  const secret = process.env.IMPORT_SECRET;
  if (user && secret) {
    await fetch(`${(process.env.TTS42_URL ?? "https://tech-team-strategy.com").replace(/\/$/, "")}/api/track`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ site: "blog", path: body.path, title: body.title, referrer: body.referrer, uid: user.id, email: user.email ?? user.phone, name: user.name }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => {});
  }
  return Response.json({ ok: true, id });
}
