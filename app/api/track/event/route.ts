import { recordEvent } from "@/lib/visitor-events";

const CLIENT_KINDS = new Set(["click", "spin_quote", "leave"]);

/** Steps reported by the browser: clicks on links and buttons, the quote the wheel landed on, leaving the site. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { kind?: string; detail?: string; path?: string } | null;
  if (!b?.kind || !CLIENT_KINDS.has(b.kind) || typeof b.detail !== "string" || (b.path && !b.path.startsWith("/"))) return new Response(null, { status: 204 });
  await recordEvent({ kind: b.kind, detail: b.detail.slice(0, 300), path: b.path?.slice(0, 300) });
  return new Response(null, { status: 204 });
}
