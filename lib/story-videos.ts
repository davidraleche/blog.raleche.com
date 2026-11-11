import "server-only";
import { execFile } from "child_process";
import { promisify } from "util";

/**
 * Stories' mini videos (8-second clips, vertical 9:16 and wide 16:9), kept in the private
 * raleche-story-videos bucket and streamed to readers by /story/<slug>/video/<format>.mp4.
 * Upload them with scripts/publish-story-videos.mjs, which also writes the bucket's manifest.json.
 */
export const VIDEO_BUCKET = process.env.STORY_VIDEO_BUCKET || "raleche-story-videos";
export const VIDEO_FORMATS = ["vertical", "wide"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export type StoryVideoInfo = { formats: VideoFormat[]; speaker?: string; text: string; credit: string; hashtags: string };
type Manifest = { stories: Record<string, StoryVideoInfo> };

let token: { value: string; until: number } | null = null;
async function accessToken() {
  if (token && token.until > Date.now()) return token.value;
  let value = "";
  try {
    const r = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(3000) });
    if (r.ok) value = ((await r.json()) as { access_token: string }).access_token;
  } catch {}
  // Local development: the developer's gcloud login.
  if (!value) value = (await promisify(execFile)("gcloud", ["auth", "print-access-token"])).stdout.trim();
  token = { value, until: Date.now() + 30 * 60 * 1000 };
  return value;
}

/** Fetch an object from the bucket (a Range header is passed through for video seeking). */
export async function bucketFetch(object: string, range?: string | null) {
  const headers: Record<string, string> = { Authorization: `Bearer ${await accessToken()}` };
  if (range) headers.Range = range;
  return fetch(`https://storage.googleapis.com/storage/v1/b/${VIDEO_BUCKET}/o/${encodeURIComponent(object)}?alt=media`, { headers, cache: "no-store" });
}

let manifest: { data: Manifest; until: number } | null = null;
async function loadManifest(): Promise<Manifest> {
  if (manifest && manifest.until > Date.now()) return manifest.data;
  try {
    const r = await bucketFetch("manifest.json");
    const data = r.ok ? ((await r.json()) as Manifest) : { stories: {} };
    manifest = { data, until: Date.now() + (r.ok ? 5 : 1) * 60 * 1000 };
    return data;
  } catch {
    // Never break the story page over the videos: hide the panel and try again in a minute.
    manifest = { data: { stories: {} }, until: Date.now() + 60 * 1000 };
    return manifest.data;
  }
}

/** The story's mini video, or null when it has none. */
export async function storyMiniVideo(slug: string): Promise<StoryVideoInfo | null> {
  const v = (await loadManifest()).stories?.[slug];
  return v && v.formats?.length ? v : null;
}
