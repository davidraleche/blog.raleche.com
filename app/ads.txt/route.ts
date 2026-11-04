import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Authorizes Google to sell ads on this domain. */
export async function GET() {
  const client = (await db.setting.findUnique({ where: { key: "adsenseClient" } }))?.value.trim() ?? "";
  const body = client.startsWith("ca-pub-") ? `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n` : "";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
