import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { importFromSource } from "@/lib/importer";

/** Lets tts42.com push one article here: POST { slug } with the shared secret. Re-uses the sitemap importer for that single article. */
export async function POST(req: Request) {
  const secret = process.env.IMPORT_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { slug?: string } | null;
  const slug = body?.slug;
  if (!slug || !/^[a-z0-9-]{1,120}$/.test(slug)) return Response.json({ error: "slug required" }, { status: 400 });
  const r = await importFromSource(undefined, slug);
  if (r.errors.length) return Response.json({ error: r.errors[0] }, { status: 502 });
  revalidatePath("/", "layout");
  return Response.json({ ok: true, created: r.created, updated: r.updated, url: `${process.env.APP_URL ?? "https://blog.raleche.com"}/story/${slug}` });
}
