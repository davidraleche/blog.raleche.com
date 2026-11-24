import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { bucketFetch, storyMiniVideo } from "./story-videos";

/**
 * Daily cross-posting of a raleche.com story to WordPress.com, X and TikTok.
 * A Claude cloud routine calls GET /api/social/next to pick the story, writes the posts, then POST /api/social/post.
 * Keys live only in Cloud Run (Secret Manager); a platform without keys is reported as "not configured".
 * What was posted is kept in the Setting table (social:<platform>:<slug>) so nothing is posted twice.
 */
export const PLATFORMS = ["wordpress", "x", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

const env = (k: string) => process.env[k]?.trim() || "";
export const site = () => (env("APP_URL") || "https://raleche.com").replace(/\/$/, "");
const WP_SITE = () => env("WP_SITE") || "thedavidraleche.wordpress.com";

/** Bearer SOCIAL_SECRET, compared in constant time. */
export function authorized(req: Request) {
  const secret = env("SOCIAL_SECRET");
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export function configured(p: Platform) {
  if (p === "wordpress") return !!(env("WP_USER") && env("WP_APP_PASSWORD"));
  if (p === "x") return !!(env("X_API_KEY") && env("X_API_SECRET") && env("X_ACCESS_TOKEN") && env("X_ACCESS_SECRET"));
  return !!(env("TIKTOK_CLIENT_KEY") && env("TIKTOK_CLIENT_SECRET") && env("TIKTOK_REFRESH_TOKEN"));
}

export type PostedRecord = { at: string; url?: string; id?: string };
const key = (p: Platform, slug: string) => `social:${p}:${slug}`;

export async function postedOn(slug: string) {
  const rows = await db.setting.findMany({ where: { key: { in: PLATFORMS.map((p) => key(p, slug)) } } });
  return Object.fromEntries(rows.map((r) => [r.key.split(":")[1], JSON.parse(r.value) as PostedRecord])) as Partial<Record<Platform, PostedRecord>>;
}
async function remember(p: Platform, slug: string, rec: PostedRecord) {
  const value = JSON.stringify(rec);
  await db.setting.upsert({ where: { key: key(p, slug) }, create: { key: key(p, slug), value }, update: { value } });
}

/** The newest published story not yet posted on every configured platform (so a backlog goes out one a day). */
export async function nextStory() {
  const live = PLATFORMS.filter(configured);
  const want = live.length ? live : [...PLATFORMS];
  const posts = await db.post.findMany({
    where: { status: "published", publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    take: 200,
    select: { slug: true, title: true, dek: true, body: true, tags: true, speaker: true, host: true, coverImage: true, publishedAt: true },
  });
  const done = new Set((await db.setting.findMany({ where: { key: { startsWith: "social:" } }, select: { key: true } })).map((r) => r.key));
  const post = posts.find((p) => want.some((pl) => !done.has(key(pl, p.slug))));
  if (!post) return null;
  const video = await storyMiniVideo(post.slug);
  const cover = post.coverImage ? (post.coverImage.startsWith("/") ? site() + post.coverImage : post.coverImage) : null;
  return {
    slug: post.slug,
    url: `${site()}/story/${post.slug}`,
    title: post.title,
    dek: post.dek,
    speaker: post.speaker,
    host: post.host,
    tags: post.tags,
    publishedAt: post.publishedAt,
    cover,
    hasVideo: !!video?.formats.includes("vertical"),
    videoHashtags: video?.hashtags ?? "",
    excerpt: post.body.slice(0, 4000),
    posted: await postedOn(post.slug),
    configured: Object.fromEntries(PLATFORMS.map((p) => [p, configured(p)])),
  };
}

// ---------- WordPress.com (application password) ----------
async function postWordpress(slug: string, wp: { title: string; html: string }) {
  const auth = Buffer.from(`${env("WP_USER")}:${env("WP_APP_PASSWORD").replace(/\s+/g, "")}`).toString("base64");
  const r = await fetch(`https://public-api.wordpress.com/wp/v2/sites/${WP_SITE()}/posts`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: wp.title, content: wp.html, status: "publish" }),
  });
  const j = (await r.json().catch(() => ({}))) as { id?: number; link?: string; message?: string };
  if (!r.ok) throw new Error(`WordPress ${r.status}: ${j.message ?? "error"}`);
  return { id: String(j.id), url: j.link };
}

// ---------- X (OAuth 1.0a user context) ----------
const pct = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
function oauthHeader(method: string, url: string) {
  const o: Record<string, string> = {
    oauth_consumer_key: env("X_API_KEY"),
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: env("X_ACCESS_TOKEN"),
    oauth_version: "1.0",
  };
  const params = Object.keys(o).sort().map((k) => `${pct(k)}=${pct(o[k])}`).join("&");
  const base = [method, pct(url), pct(params)].join("&");
  o.oauth_signature = createHmac("sha1", `${pct(env("X_API_SECRET"))}&${pct(env("X_ACCESS_SECRET"))}`).update(base).digest("base64");
  return "OAuth " + Object.keys(o).sort().map((k) => `${pct(k)}="${pct(o[k])}"`).join(", ");
}
async function postX(x: { text: string }) {
  const url = "https://api.x.com/2/tweets";
  const r = await fetch(url, { method: "POST", headers: { Authorization: oauthHeader("POST", url), "Content-Type": "application/json" }, body: JSON.stringify({ text: x.text }) });
  const j = (await r.json().catch(() => ({}))) as { data?: { id: string }; detail?: string; title?: string };
  if (!r.ok || !j.data) throw new Error(`X ${r.status}: ${j.detail ?? j.title ?? "error"}`);
  return { id: j.data.id, url: `https://x.com/i/status/${j.data.id}` };
}

// ---------- TikTok (Content Posting API, file upload of the story's vertical clip) ----------
async function tiktokToken() {
  // TikTok can rotate the refresh token: the newest one is kept in the database.
  const saved = await db.setting.findUnique({ where: { key: "tiktokRefreshToken" } });
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"), grant_type: "refresh_token", refresh_token: saved?.value || env("TIKTOK_REFRESH_TOKEN") }),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error_description?: string };
  if (!j.access_token) throw new Error(`TikTok token: ${j.error_description ?? r.status}`);
  if (j.refresh_token) await db.setting.upsert({ where: { key: "tiktokRefreshToken" }, create: { key: "tiktokRefreshToken", value: j.refresh_token }, update: { value: j.refresh_token } });
  return j.access_token;
}
async function postTiktok(slug: string, tk: { caption: string }) {
  const video = await storyMiniVideo(slug);
  if (!video?.formats.includes("vertical")) throw new Error("no vertical video for this story");
  const file = await bucketFetch(`stories/${slug}/vertical.mp4`);
  if (!file.ok) throw new Error(`video fetch ${file.status}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const token = await tiktokToken();
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" };
  // Until TikTok audits the app, posts can only be private (SELF_ONLY). Set TIKTOK_PRIVACY=PUBLIC_TO_EVERYONE after approval.
  const init = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      post_info: { title: tk.caption.slice(0, 2200), privacy_level: env("TIKTOK_PRIVACY") || "SELF_ONLY", disable_comment: false, disable_duet: false, disable_stitch: false },
      source_info: { source: "FILE_UPLOAD", video_size: bytes.length, chunk_size: bytes.length, total_chunk_count: 1 },
    }),
  });
  const ij = (await init.json().catch(() => ({}))) as { data?: { publish_id: string; upload_url: string }; error?: { code: string; message: string } };
  if (!ij.data?.upload_url) throw new Error(`TikTok init: ${ij.error?.message ?? init.status}`);
  const up = await fetch(ij.data.upload_url, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Range": `bytes 0-${bytes.length - 1}/${bytes.length}` }, body: bytes });
  if (!up.ok) throw new Error(`TikTok upload ${up.status}`);
  return { id: ij.data.publish_id };
}

export type PostRequest = { slug: string; wordpress?: { title: string; html: string }; x?: { text: string }; tiktok?: { caption: string } };
export type PostResult = { status: "posted" | "already" | "not configured" | "skipped" | "failed"; url?: string; id?: string; error?: string };

/** Post what the routine wrote to each platform that has keys and hasn't had this story yet. */
export async function postStory(req: PostRequest): Promise<Record<Platform, PostResult>> {
  const post = await db.post.findFirst({ where: { slug: req.slug, status: "published" }, select: { slug: true } });
  if (!post) throw new Error("unknown story");
  const already = await postedOn(req.slug);
  const out = {} as Record<Platform, PostResult>;
  for (const p of PLATFORMS) {
    if (already[p]) { out[p] = { status: "already", ...already[p] }; continue; }
    if (!configured(p)) { out[p] = { status: "not configured" }; continue; }
    if (!req[p]) { out[p] = { status: "skipped", error: "no text given" }; continue; }
    try {
      const r = p === "wordpress" ? await postWordpress(req.slug, req.wordpress!) : p === "x" ? await postX(req.x!) : await postTiktok(req.slug, req.tiktok!);
      await remember(p, req.slug, { at: new Date().toISOString(), ...r });
      out[p] = { status: "posted", ...r };
    } catch (e) {
      out[p] = { status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  }
  return out;
}
