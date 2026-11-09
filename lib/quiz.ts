import "server-only";
import { db } from "./db";
import { geminiJson } from "./vertex";

export type QuizQuestion = { q: string; options: string[]; answer: number };


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

/** Asks Gemini whether each question's correct answer is explicitly stated in the summary. */
export async function answersInSummary(summary: string, quiz: QuizQuestion[]): Promise<boolean[]> {
  const list = quiz.map((x, i) => `${i + 1}. ${x.q}\n   Correct answer: ${x.options[x.answer]}`).join("\n");
  const out = await geminiJson<{ supported: boolean }[]>(
    `Below is an executive summary and two quiz questions with their correct answers. For each question, say whether the correct answer is explicitly stated in the summary (not just plausible or implied). Be strict.\n\nSUMMARY:\n${summary.slice(0, 20000)}\n\nQUESTIONS:\n${list}`,
    { type: "ARRAY", minItems: quiz.length, maxItems: quiz.length, items: { type: "OBJECT", required: ["supported"], properties: { supported: { type: "BOOLEAN" } } } },
    0,
  );
  return quiz.map((_, i) => out?.[i]?.supported === true);
}

/**
 * Questions are written from the executive summary, and every correct answer is checked against it,
 * so readers who miss can always find the answers there. Tries up to 3 times.
 */
export async function generateQuiz(title: string, summary: string): Promise<QuizQuestion[]> {
  const prompt = `Write a 2-question multiple-choice quiz from this article's executive summary, medium difficulty: someone who read the summary gets both right, someone who only read the headline does not. Every correct answer must be stated in the summary. Ask about specific claims, numbers, examples or recommendations. Each question has exactly 4 plausible options of similar length with one correct answer; vary its position. Only use facts stated in the summary. Questions under 140 characters, options under 80.

Title: ${title}

${summary.slice(0, 20000)}`;
  let last = "Vertex AI returned an invalid quiz";
  for (let attempt = 0; attempt < 3; attempt++) {
    const quiz = await geminiJson<unknown>(prompt, {
      type: "ARRAY", minItems: 2, maxItems: 2,
      items: { type: "OBJECT", required: ["q", "options", "answer"], properties: { q: { type: "STRING" }, options: { type: "ARRAY", minItems: 4, maxItems: 4, items: { type: "STRING" } }, answer: { type: "INTEGER" } } },
    }, 0.4);
    if (!isValidQuiz(quiz)) continue;
    const ok = await answersInSummary(summary, quiz);
    if (ok.every(Boolean)) return quiz;
    last = "Could not write a quiz whose answers are all stated in the executive summary";
  }
  throw new Error(last);
}

/** The article's quiz, generating and saving one the first time if none exists. Never throws. */
export async function ensureQuiz(post: { id: string; title: string; body: string; executiveSummary: string }) {
  const existing = await getQuiz(post.id);
  if (existing || Date.now() < pausedUntil || process.env.QUIZ_AUTOGEN === "off") return existing;
  try {
    const questions = await generateQuiz(post.title, post.executiveSummary || post.body);
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
