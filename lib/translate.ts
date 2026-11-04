import "server-only";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "./db";
import type { Locale } from "./i18n/messages";

// Google Cloud Translation (v3), called with the Cloud Run service account. Results are cached in the
// Translation table, so each piece of text is translated once per language.
const TARGET: Record<Exclude<Locale, "en">, string> = { fr: "fr", es: "es", zh: "zh-CN" };
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "raleche-blog";
const MAX_CHARS = 20_000; // per request; the API limit is 30k code points

type Format = "text" | "html";
const keyOf = (lang: string, format: Format, s: string) => crypto.createHash("sha256").update(`${lang}\0${format}\0${s}`).digest("hex");

let token: { value: string; exp: number } | null = null;
let pausedUntil = 0; // after a failure, serve English for a minute instead of retrying on every request
async function accessToken() {
  if (token && token.exp > Date.now() + 60e3) return token.value;
  try {
    const r = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(1500),
    });
    if (r.ok) {
      const j = (await r.json()) as { access_token: string; expires_in: number };
      token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
      return token.value;
    }
  } catch {}
  // Local development: use the developer's gcloud login.
  const { stdout } = await promisify(execFile)("gcloud", ["auth", "print-access-token"]);
  token = { value: stdout.trim(), exp: Date.now() + 30 * 60e3 };
  return token.value;
}

async function callApi(lang: Exclude<Locale, "en">, contents: string[], format: Format) {
  const res = await fetch(`https://translation.googleapis.com/v3/projects/${PROJECT}/locations/global:translateText`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", "x-goog-user-project": PROJECT },
    body: JSON.stringify({ contents, sourceLanguageCode: "en", targetLanguageCode: TARGET[lang], mimeType: format === "html" ? "text/html" : "text/plain" }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Translation API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { translations: { translatedText: string }[] };
  return j.translations.map((t) => t.translatedText);
}

/** Translate many strings from English. Falls back to the English text if the API is unavailable. */
export async function translateMany(lang: Locale, items: string[], format: Format = "text"): Promise<string[]> {
  if (lang === "en" || !items.length) return items;
  const keys = items.map((s) => (s.trim() ? keyOf(lang, format, s) : ""));
  const cached = new Map((await db.translation.findMany({ where: { id: { in: keys.filter(Boolean) } } })).map((r) => [r.id, r.text]));

  const missing = [...new Map(items.map((s, i) => [keys[i], s] as const).filter(([k]) => k && !cached.has(k))).entries()];
  if (missing.length && Date.now() > pausedUntil) {
    try {
      for (let i = 0; i < missing.length; ) {
        const batch: (typeof missing)[number][] = [];
        let size = 0;
        while (i < missing.length && batch.length < 100 && (batch.length === 0 || size + missing[i][1].length <= MAX_CHARS)) {
          size += missing[i][1].length;
          batch.push(missing[i++]);
        }
        const out = await callApi(lang, batch.map(([, s]) => s), format);
        const rows = batch.map(([id], j) => ({ id, lang, text: out[j] }));
        await db.translation.createMany({ data: rows, skipDuplicates: true });
        rows.forEach((r) => cached.set(r.id, r.text));
      }
    } catch (e) {
      pausedUntil = Date.now() + 60e3;
      console.error("[translate]", (e as Error).message.split("\n")[0]);
    }
  }
  return items.map((s, i) => cached.get(keys[i]) ?? s);
}

export async function translateOne(lang: Locale, s: string, format: Format = "text") {
  return (await translateMany(lang, [s], format))[0];
}

/** Translate a long HTML document block by block, so each request stays under the size limit. */
export async function translateHtml(lang: Locale, html: string) {
  if (lang === "en" || !html) return html;
  const blocks = html.split(/(?<=<\/(?:p|h[1-6]|ul|ol|blockquote|pre|table|figure)>)\s*/);
  const chunks: string[] = [];
  for (const b of blocks) {
    if (chunks.length && chunks[chunks.length - 1].length + b.length < MAX_CHARS / 2) chunks[chunks.length - 1] += b;
    else chunks.push(b);
  }
  return (await translateMany(lang, chunks, "html")).join("\n");
}
