import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "./db";
import type { Locale } from "./i18n/messages";
import { geminiJson, LITE_MODELS } from "./vertex";

// Gemini Flash-Lite on Vertex AI (about 100x cheaper than Google Cloud Translation), with Cloud Translation (v3)
// as the fallback for a batch Gemini gets wrong. Both use the Cloud Run service account. Results are cached in the
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

const LANG_NAME: Record<Exclude<Locale, "en">, string> = { fr: "French", es: "Spanish", zh: "Simplified Chinese" };
const GEMINI_CHARS = 12_000; // per Gemini request: keeps answers fast and well under the output limit

async function callGemini(lang: Exclude<Locale, "en">, contents: string[], format: Format) {
  const prompt = [
    `Translate each string in the JSON array below from English to ${LANG_NAME[lang]}.`,
    "These are texts from a site about interviews with tech leaders: keep the tone natural and idiomatic, not word for word.",
    "Keep people's names, company and product names, code, URLs, numbers and @handles unchanged.",
    format === "html" ? "The strings are HTML: keep every tag and attribute exactly as it is and translate only the visible text." : "Keep markdown, line breaks and punctuation marks such as quotes as they are.",
    `Answer with {"translations": [...]}: exactly ${contents.length} strings, in the same order, one per input string.`,
    "",
    JSON.stringify(contents),
  ].join("\n");
  const r = await geminiJson<{ translations: string[] }>(prompt, { type: "OBJECT", properties: { translations: { type: "ARRAY", items: { type: "STRING" } } }, required: ["translations"] }, 0.2, 120_000, LITE_MODELS);
  const out = r?.translations;
  if (!Array.isArray(out) || out.length !== contents.length || out.some((t, i) => typeof t !== "string" || (!t.trim() && !!contents[i].trim()))) throw new Error("Gemini returned a bad translation list");
  return out;
}

/** Gemini first; Cloud Translation only if Gemini fails for this batch. */
async function translateBatch(lang: Exclude<Locale, "en">, contents: string[], format: Format) {
  try {
    return await callGemini(lang, contents, format);
  } catch (e) {
    console.error("[translate] gemini failed, using Cloud Translation:", (e as Error).message.split("\n")[0]);
    return callApi(lang, contents, format);
  }
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
        while (i < missing.length && batch.length < 40 && (batch.length === 0 || size + missing[i][1].length <= GEMINI_CHARS)) {
          size += missing[i][1].length;
          batch.push(missing[i++]);
        }
        const out = await translateBatch(lang, batch.map(([, s]) => s), format);
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
