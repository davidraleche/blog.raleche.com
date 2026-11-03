import { getUser } from "@/lib/auth";

/** Page-visit beacon: if a member is signed in, forwards the visit to the tts42 admin log. */
export async function POST(req: Request) {
  const user = await getUser();
  const secret = process.env.IMPORT_SECRET;
  if (!user || !secret) return Response.json({ ok: true });
  const body = (await req.json().catch(() => null)) as { path?: string; title?: string; referrer?: string } | null;
  if (!body?.path || !body.path.startsWith("/")) return Response.json({ error: "path required" }, { status: 400 });
  await fetch(`${(process.env.TTS42_URL ?? "https://tech-team-strategy.com").replace(/\/$/, "")}/api/track`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ site: "blog", path: body.path, title: body.title, referrer: body.referrer, uid: user.id, email: user.email ?? user.phone, name: user.name }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});
  return Response.json({ ok: true });
}
