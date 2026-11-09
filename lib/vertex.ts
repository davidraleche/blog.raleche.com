import "server-only";
import { execFile } from "child_process";
import { promisify } from "util";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "raleche-blog";
// Tried in order; the first one this project can use is remembered. Set GEMINI_MODEL to force one.
const MODELS = [process.env.GEMINI_MODEL || process.env.QUIZ_MODEL, "gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-3.6-flash", "gemini-3-flash-preview"].filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
let workingModel: string | null = null;

async function accessToken() {
  // On Cloud Run the metadata server answers; it can be slow under load, so retry before giving up.
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(5000) });
      if (r.ok) return ((await r.json()) as { access_token: string }).access_token;
    } catch {}
  }
  // Local development: the developer's gcloud login.
  const { stdout } = await promisify(execFile)("gcloud", ["auth", "print-access-token"]);
  return stdout.trim();
}

/** Ask Gemini on Vertex AI for JSON matching a response schema. Throws if Vertex AI is off or the call fails. */
export async function geminiJson<T>(prompt: string, responseSchema: object, temperature = 0.3): Promise<T> {
  const token = await accessToken();
  const candidates = workingModel ? [workingModel] : MODELS;
  let lastError = "no model available";
  for (const model of candidates) {
    const res = await fetch(`https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${model}:generateContent`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature, responseMimeType: "application/json", responseSchema } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 404 && !workingModel) { lastError = `Vertex AI 404 for ${model}`; continue; } // not available to this project: try the next one
    if (!res.ok) throw new Error(`Vertex AI ${res.status} (${model}): ${(await res.text()).replace(/\s+/g, " ").slice(0, 300)}`);
    if (!workingModel) { workingModel = model; console.log(`[vertex] using ${model}`); }
    const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "null") as T;
  }
  throw new Error(`${lastError}; none of ${MODELS.join(", ")} is available to project ${PROJECT}`);
}
