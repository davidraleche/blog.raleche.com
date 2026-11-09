import "server-only";
import { db } from "./db";
import { geminiJson } from "./vertex";
import { isValidMentions, saveMentions, RELATIONS, STANCES, type Mentions } from "./books";

let pausedUntil = 0;

export async function extractMentions(title: string, body: string): Promise<Mentions> {
  const prompt = `From this interview article, list (1) books the guest or host says they read, are reading, recommend, were shaped by, or wrote, and (2) people the guest openly admires or openly criticizes.
Use real full book titles and authors; skip books only named in passing. Only list a criticism when the article clearly reports it (a quote or explicit statement); never infer hostility. "who" is the person who said it. Notes are short reasons from the article, under 140 characters. Return empty lists when there are none.

Title: ${title}

${body.slice(0, 24000)}`;
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
export async function ensureMentions(post: { id: string; title: string; body: string }) {
  if (Date.now() < pausedUntil || process.env.MENTIONS_AUTOGEN === "off") return;
  const fresh = await db.post.findUnique({ where: { id: post.id }, select: { mentionsAt: true } });
  if (fresh?.mentionsAt) return;
  try {
    await saveMentions(post.id, await extractMentions(post.title, post.body));
  } catch (e) {
    pausedUntil = Date.now() + 10 * 60e3;
    console.error(`[books] extraction failed for ${post.id}: ${(e as Error).message}`);
  }
}
