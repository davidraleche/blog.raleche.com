import "server-only";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "./db";

export type QuizQuestion = { q: string; options: string[]; answer: number };

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "raleche-blog";
const MODEL = process.env.QUIZ_MODEL || "gemini-2.5-flash";

export function isValidQuiz(v: unknown): v is QuizQuestion[] {
  return (
    Array.isArray(v) && v.length === 2 &&
    v.every((x) => x && typeof x.q === "string" && Array.isArray(x.options) && x.options.length === 4 && x.options.every((o: unknown) => typeof o === "string") && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < 4)
  );
}

export async function getQuiz(postId: string): Promise<QuizQuestion[] | null> {
  const row = await db.quiz.findUnique({ where: { postId } });
  return row && isValidQuiz(row.questions) ? row.questions : null;
}

/* ---------- Automatic generation with Gemini on Vertex AI ---------- */
let pausedUntil = 0; // after a failure (e.g. Vertex AI not enabled), don't retry on every page view
async function accessToken() {
  try {
    const r = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(1500) });
    if (r.ok) return ((await r.json()) as { access_token: string }).access_token;
  } catch {}
  const { stdout } = await promisify(execFile)("gcloud", ["auth", "print-access-token"]);
  return stdout.trim();
}

export async function generateQuiz(title: string, body: string): Promise<QuizQuestion[]> {
  const prompt = `Write a 2-question multiple-choice quiz about this article, medium difficulty: an attentive reader gets both right, someone who only read the headline does not. Ask about specific claims, numbers, examples or recommendations in the article. Each question has exactly 4 plausible options of similar length with one correct answer; vary its position. Only use facts stated in the article. Questions under 140 characters, options under 80.

Title: ${title}

${body.slice(0, 20000)}`;
  const res = await fetch(`https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY", minItems: 2, maxItems: 2,
          items: { type: "OBJECT", required: ["q", "options", "answer"], properties: { q: { type: "STRING" }, options: { type: "ARRAY", minItems: 4, maxItems: 4, items: { type: "STRING" } }, answer: { type: "INTEGER" } } },
        },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Vertex AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const quiz = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "null");
  if (!isValidQuiz(quiz)) throw new Error("Vertex AI returned an invalid quiz");
  return quiz;
}

/** The article's quiz, generating and saving one the first time if none exists. Never throws. */
export async function ensureQuiz(post: { id: string; title: string; body: string }) {
  const existing = await getQuiz(post.id);
  if (existing || Date.now() < pausedUntil || process.env.QUIZ_AUTOGEN === "off") return existing;
  try {
    const questions = await generateQuiz(post.title, post.body);
    await db.quiz.upsert({ where: { postId: post.id }, create: { postId: post.id, questions, source: "ai" }, update: {} });
    return questions;
  } catch (e) {
    pausedUntil = Date.now() + 10 * 60e3;
    console.error(`[quiz] generation failed for ${post.id}: ${(e as Error).message}`);
    return null;
  }
}

/** The next story to play after a miss: the next older one, else the newest. */
export async function nextStory(postId: string, publishedAt: Date | null) {
  const older = publishedAt ? await db.post.findFirst({ where: { status: "published", id: { not: postId }, publishedAt: { lt: publishedAt } }, orderBy: { publishedAt: "desc" }, select: { slug: true, title: true } }) : null;
  return older ?? db.post.findFirst({ where: { status: "published", id: { not: postId } }, orderBy: { publishedAt: "desc" }, select: { slug: true, title: true } });
}
