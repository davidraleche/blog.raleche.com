// Short "why read it" pitches for books our guests mention, written by Gemini once per book and saved on Book.pitch.
// Shown in the reading-list box of every email (lib/email-books.ts). No server-only imports, so scripts can run it.
import { db } from "./db";
import { geminiJson } from "./vertex";

type PitchIn = { i: number; title: string; author: string; who: string; note: string };

const SCHEMA = {
  type: "OBJECT",
  properties: { pitches: { type: "ARRAY", items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, pitch: { type: "STRING" } }, required: ["i", "pitch"] } } },
  required: ["pitches"],
};

async function writePitches(books: PitchIn[]) {
  const list = books.map((b) => `${b.i}. "${b.title}" by ${b.author}. Mentioned by ${b.who}${b.note ? `: ${b.note}` : ""}`).join("\n");
  const r = await geminiJson<{ pitches: { i: number; pitch: string }[] }>(
    `You write the reading list of a newsletter for tech leaders and founders. For each book below, write one exciting pitch that makes the reader want to buy it now: what they will get from it, in concrete terms.
Rules: one or two short sentences, at most 28 words. Energetic but credible, no hype words like "must-read" or "game-changer", no emoji, no quotation marks.
Only state what the book is widely known to be about. Never claim new editions, updates, awards or sales figures. If you do not know the book, base the pitch on the title and on what the person said about it, without inventing details.

BOOKS:
${list}`,
    SCHEMA,
    0.7,
  );
  return r.pitches;
}

/** Fill in missing pitches, most-mentioned books first. Returns how many were written. */
export async function fillBookPitches(limit = 40) {
  const missing = await db.book.findMany({
    where: { pitch: "", mentions: { some: {} } },
    select: { id: true, title: true, author: true, mentions: { select: { who: true, note: true } }, _count: { select: { mentions: true } } },
    orderBy: { mentions: { _count: "desc" } },
    take: limit,
  });
  let written = 0;
  for (let start = 0; start < missing.length; start += 10) {
    const batch = missing.slice(start, start + 10);
    const pitches = await writePitches(
      batch.map((b, i) => ({ i, title: b.title, author: b.author, who: [...new Set(b.mentions.map((m) => m.who))].slice(0, 3).join(", "), note: b.mentions.find((m) => m.note)?.note ?? "" })),
    );
    for (const p of pitches) {
      const book = batch[p.i];
      const text = p.pitch?.trim().replace(/^["“]|["”]$/g, "");
      if (!book || !text) continue;
      await db.book.update({ where: { id: book.id }, data: { pitch: text.slice(0, 300) } });
      written++;
    }
  }
  return written;
}
