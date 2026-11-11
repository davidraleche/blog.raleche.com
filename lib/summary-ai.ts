import "server-only";
import { geminiJson } from "./vertex";
import { answersInSummary, type QuizQuestion } from "./quiz";

/**
 * The paid executive summary of a story: long and detailed, written from the full interview transcript when there
 * is one (otherwise from our article), and stating the answer to every quiz question, which it ends with.
 */
export async function writeExecutiveSummary(
  post: { title: string; body: string; dek?: string; speaker?: string | null; host?: string | null; show?: string | null },
  transcript: string | null,
  quiz: QuizQuestion[] | null,
): Promise<string> {
  const people = [post.speaker && `Guest: ${post.speaker}`, post.host && `Host: ${post.host}`, post.show && `Show: ${post.show}`].filter(Boolean).join("\n");
  const facts = quiz?.length
    ? `\nThese quiz questions are asked about the story. The summary must state each correct answer explicitly, in its own words, in the section where it fits:\n${quiz.map((q, i) => `${i + 1}. ${q.q} -> ${q.options[q.answer]}`).join("\n")}\n`
    : "";
  const source = transcript ? `FULL INTERVIEW TRANSCRIPT (automatic, with timestamps)\n${transcript.slice(0, 400_000)}\n\nOUR ARTICLE ABOUT IT\n${post.body.slice(0, 30000)}` : `OUR ARTICLE\n${post.body.slice(0, 40000)}`;
  const prompt = `You are writing a paid executive summary for busy business owners and executives who will not watch the interview. It must be very detailed and long (2,500 to 4,000 words), so that reading it is as good as watching the whole conversation: every important idea, example, number, name, company and recommendation, with the reasoning behind it. Only use what is in the source; never invent facts, numbers or quotes.

Write it in Markdown with exactly these sections, in this order:
## At a glance
6 to 8 bullets, each one full sentence with a concrete takeaway.
## Who is speaking and why it matters
A short paragraph on the guest(s), host and context.
## The key ideas in detail
One ### subsection per major theme of the conversation (usually 6 to 10), each with 2 to 4 substantial paragraphs explaining what was said, the examples given and why it matters. Include short direct quotes (under 25 words) with their timestamp in brackets when the transcript has one, e.g. "..." [12:30].
## Numbers and facts worth remembering
A bullet list of every figure, date, company and named example, each with one line of context.
## What it means for your business
6 to 10 numbered, specific actions a business owner can take, each explained in 2 to 3 sentences.
## A 30-60-90 day plan
Three short lists: first 30 days, days 31 to 60, days 61 to 90.

Plain, clear English. No preamble, no title line, no sign-off.${facts}
Title: ${post.title}${post.dek ? `\nSummary line: ${post.dek}` : ""}${people ? `\n${people}` : ""}

${source}`;

  let best = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await geminiJson<{ markdown?: string }>(prompt, { type: "OBJECT", required: ["markdown"], properties: { markdown: { type: "STRING" } } }, 0.3, 240_000);
    const md = (out?.markdown ?? "").trim().replace(/^#\s+[^\n]*\n+/, "");
    if (md.split(/\s+/).length < 1200) { best ||= md; continue; }
    best = md;
    if (!quiz?.length || (await answersInSummary(md, quiz)).every(Boolean)) break;
  }
  if (best.split(/\s+/).length < 600) throw new Error("Vertex AI returned an executive summary that is too short");
  return best + (quiz?.length ? quizAnswers(quiz) : "");
}

/** Closing section with each quiz question and its correct answer. */
export function quizAnswers(quiz: QuizQuestion[]) {
  return `\n\n## Quiz answers\n\n${quiz.map((q, i) => `${i + 1}. **${q.q}**\n   Answer: ${q.options[q.answer]}`).join("\n")}\n`;
}
