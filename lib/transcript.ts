import "server-only";

/** One speaker turn: [speaker ("" when unknown), timestamp as shown in the video ("1:02:11"), text]. */
export type Segment = [string, string, string];

/** Interview transcripts are kept by Tech Team Strategy and fetched server-to-server with the shared import secret. */
export async function loadTranscript(slug: string): Promise<Segment[] | null> {
  const secret = process.env.IMPORT_SECRET;
  if (!secret) return null;
  const base = (process.env.TTS42_URL ?? "https://tech-team-strategy.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/transcript/${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 86400, tags: [`transcript:${slug}`] },
    });
    if (!res.ok) return null;
    const { segments } = (await res.json()) as { segments: Segment[] };
    return segments?.length ? segments : null;
  } catch {
    return null;
  }
}

export const hasTranscript = async (slug: string) => !!(await loadTranscript(slug));

/** "1:02:11" or "04:31" in seconds, for a link to that moment in the video. */
export const toSeconds = (t: string) => t.split(":").reduce((s, n) => s * 60 + (Number(n) || 0), 0);
