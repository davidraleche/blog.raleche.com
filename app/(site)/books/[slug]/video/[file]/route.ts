import { bucketFetch, bookMiniVideo, VIDEO_FORMATS, type VideoFormat } from "@/lib/story-videos";

export const dynamic = "force-dynamic";

/** Stream a book's share video: /books/<slug>/video/vertical.mp4 or wide.mp4 (?download=1 saves it as a file). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await params;
  const format = file.replace(/\.mp4$/, "") as VideoFormat;
  if (!VIDEO_FORMATS.includes(format)) return new Response("Not found", { status: 404 });
  const info = await bookMiniVideo(slug);
  if (!info?.formats.includes(format)) return new Response("Not found", { status: 404 });

  const upstream = await bucketFetch(`books/${slug}/${format}.mp4`, req.headers.get("range"));
  if (!upstream.ok || !upstream.body) return new Response(upstream.status === 416 ? "Range not satisfiable" : "Not found", { status: upstream.status === 416 ? 416 : 404 });

  const headers = new Headers({ "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400" });
  for (const h of ["content-length", "content-range", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (new URL(req.url).searchParams.has("download")) headers.set("Content-Disposition", `attachment; filename="raleche-book-${slug}-${format}.mp4"`);
  return new Response(upstream.body, { status: upstream.status, headers });
}
