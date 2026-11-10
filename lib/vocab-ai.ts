import "server-only";
import { db } from "./db";
import { geminiJson } from "./vertex";
import { fetchTranscript } from "./mentions-ai";
import { isValidVocab, saveVocab, VOCAB_CATEGORIES, type VocabIn } from "./vocab";

let pausedUntil = 0;

/** The words and expressions worth learning from an interview, each with a plain definition and the person who used it. */
export async function extractVocab(post: { title: string; body: string; speaker?: string | null; host?: string | null }, transcript?: string | null): Promise<VocabIn[]> {
  const source = transcript ? `INTERVIEW TRANSCRIPT\n${transcript.slice(0, 400_000)}\n\nOUR ARTICLE\n${post.body.slice(0, 24000)}` : post.body.slice(0, 24000);
  const people = [post.speaker && `guest: ${post.speaker}`, post.host && `host: ${post.host}`].filter(Boolean).join(", ");
  const prompt = `Build a vocabulary list from this interview${transcript ? " (full transcript, then our article about it)" : " article"} for readers who want to learn the words smart people use, and later be quizzed on "what does that mean?".
Pick 12 to 30 terms that the speakers actually used, in four categories:
- "elegant": refined, precise or uncommon English words and idioms (e.g. "pernicious", "first principles", "table stakes", "inflection point"); not everyday words.
- "ai": AI and machine-learning terms (e.g. "inference", "agentic", "fine-tuning", "context window").
- "tech": technology, software and business-of-tech terms (e.g. "latency", "moat", "unit economics", "API").
- "trend": names of current tech trends and buzzwords (e.g. "vibe coding", "AI-native", "sovereign AI").
For each: "term" as used (lowercase unless a proper noun or acronym), "definition" in plain English under 25 words that a curious non-expert understands and that fits how it was used here, "who" is the full name of the person who said it${people ? ` (${people})` : ""}, and "quote" is a short sentence from the interview where they used it (under 200 characters, lightly cleaned up). Skip a term if you cannot tell who said it. No duplicates; prefer terms that teach something.

Title: ${post.title}

${source}`;
  const terms = await geminiJson<unknown>(prompt, {
    type: "ARRAY",
    items: { type: "OBJECT", required: ["term", "definition", "category", "who", "quote"], properties: { term: { type: "STRING" }, definition: { type: "STRING" }, category: { type: "STRING", enum: [...VOCAB_CATEGORIES] }, who: { type: "STRING" }, quote: { type: "STRING" } } },
  });
  if (!isValidVocab(terms)) throw new Error("Vertex AI returned an invalid vocabulary");
  return terms;
}

/** First time an article is viewed without a vocabulary, extract it in the background. Never throws. */
export async function ensureVocab(post: { id: string; slug: string; title: string; body: string; speaker?: string | null; host?: string | null }) {
  if (Date.now() < pausedUntil || process.env.VOCAB_AUTOGEN === "off") return;
  const fresh = await db.post.findUnique({ where: { id: post.id }, select: { vocabAt: true } });
  if (fresh?.vocabAt) return;
  try {
    await saveVocab(post.id, await extractVocab(post, await fetchTranscript(post.slug)));
  } catch (e) {
    pausedUntil = Date.now() + 10 * 60e3;
    console.error(`[vocab] extraction failed for ${post.id}: ${(e as Error).message}`);
  }
}
