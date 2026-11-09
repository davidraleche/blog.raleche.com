import "server-only";
import { execFile } from "child_process";
import { promisify } from "util";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "raleche-blog";
const MODEL = process.env.GEMINI_MODEL || process.env.QUIZ_MODEL || "gemini-2.5-flash";

async function accessToken() {
  try {
    const r = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(1500) });
    if (r.ok) return ((await r.json()) as { access_token: string }).access_token;
  } catch {}
  // Local development: the developer's gcloud login.
  const { stdout } = await promisify(execFile)("gcloud", ["auth", "print-access-token"]);
  return stdout.trim();
}

/** Ask Gemini on Vertex AI for JSON matching a response schema. Throws if Vertex AI is off or the call fails. */
export async function geminiJson<T>(prompt: string, responseSchema: object, temperature = 0.3): Promise<T> {
  const res = await fetch(`https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature, responseMimeType: "application/json", responseSchema } }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Vertex AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "null") as T;
}
