import "server-only";
import { db } from "./db";
import { geminiJson } from "./vertex";
import { isValidMentions, saveMentions, RELATIONS, STANCES, type Mentions } from "./books";

let pausedUntil = 0;

/** The interview's full transcript from Tech Team Strategy, as plain text, or null when there isn't one. */
export async function fetchTranscript(slug: string): Promise<string | null> {
  const secret = process.env.IMPORT_SECRET;
  if (!secret) return null;
  const base = (process.env.TTS42_URL ?? "https://tech-team-strategy.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/transcript/${slug}`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!res.ok) return null;
    const { segments } = (await res.json()) as { segments: [string, string, string][] };
    return segments.map(([who, at, text]) => `${who ? `${who} ` : ""}[${at}]: ${text}`).join("\n");
  } catch {
    return null;
  }
}

/** Books and people from an interview. With the transcript, the whole conversation is read (books often never reach the summary). */
export async function extractMentions(title: string, body: string, transcript?: string | null): Promise<Mentions> {
  const source = transcript ? `INTERVIEW TRANSCRIPT\n${transcript.slice(0, 400_000)}\n\nOUR ARTICLE\n${body.slice(0, 24000)}` : body.slice(0, 24000);
  const prompt = `From this interview${transcript ? " (full transcript, then our article about it)" : " article"}, list (1) books the guest or host says they read, are reading, recommend, were shaped by, or wrote, and (2) people the guest openly admires or openly criticizes.
Use real full book titles and authors (correct the spelling of titles a transcript gets wrong); skip books only named in passing.
Also add up to 3 of the best-known books written by the main guest (relation "wrote", "who" is the guest, note "Book by <guest name>"), even if the interview doesn't mention them, but only real, published books you are certain the guest wrote; none if the guest has not written a book. Only list a criticism when it is clearly stated (a quote or explicit statement); never infer hostility. "who" is the person who said it. Notes are short reasons from the interview, under 140 characters. Return empty lists when there are none.

Title: ${title}

${source}`;
  const m = await geminiJson<unknown>(prompt, {
    type: "OBJECT", required: ["books", "people"],
    properties: {
      books: { type: "ARRAY", items: { type: "OBJECT", required: ["title", "author", "who", "relation", "note"], properties: { title: { type: "STRING" }, author: { type: "STRING" }, who: { type: "STRING" }, relation: { type: "STRING", enum: [...RELATIONS] }, note: { type: "STRING" } } } },
      people: { type: "ARRAY", items: { type: "OBJECT", required: ["name", "who", "stance", "note"], properties: { name: { type: "STRING" }, who: { type: "STRING" }, stance: { type: "STRING", enum: [...STANCES] }, note: { type: "STRING" } } } },
    },
  });
  if (!isValidMentions(m)) throw new Error("Vertex AI returned invalid mentions");
  return m;
}

/** First time an article is viewed, extract its books and people in the background. Never throws. */
export async function ensureMentions(post: { id: string; slug: string; title: string; body: string }) {
  if (Date.now() < pausedUntil || process.env.MENTIONS_AUTOGEN === "off") return;
  const fresh = await db.post.findUnique({ where: { id: post.id }, select: { mentionsAt: true } });
  if (fresh?.mentionsAt) return;
  try {
    await saveMentions(post.id, await extractMentions(post.title, post.body, await fetchTranscript(post.slug)));
  } catch (e) {
    pausedUntil = Date.now() + 10 * 60e3;
    console.error(`[books] extraction failed for ${post.id}: ${(e as Error).message}`);
  }
}
