// Vocabulary used in interviews: elegant words, AI, tech and trend terms, each tied to the speaker who used it.
// No server-only imports, so scripts can use it too.
import { db } from "./db";

export const VOCAB_CATEGORIES = ["elegant", "ai", "tech", "trend"] as const;
export type VocabCategory = (typeof VOCAB_CATEGORIES)[number];
export type VocabIn = { term: string; definition: string; category: string; who: string; quote?: string };

export function isValidVocab(v: unknown): v is VocabIn[] {
  const str = (x: unknown) => typeof x === "string" && x.trim().length > 0;
  return Array.isArray(v) && v.every((t) => !!t && str(t.term) && str(t.definition) && str(t.who) && (VOCAB_CATEGORIES as readonly string[]).includes(t.category));
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Existing terms first (they may be admin edits), then new ones not already listed. */
export function mergeVocab(old: VocabIn[], add: VocabIn[]): VocabIn[] {
  return [...old, ...add.filter((a) => !old.some((o) => key(o.term) === key(a.term)))];
}

/** Replace an article's vocabulary. */
export async function saveVocab(postId: string, terms: VocabIn[]) {
  const seen = new Set<string>();
  const rows = terms
    .map((t) => ({ postId, term: t.term.trim().slice(0, 80), definition: t.definition.trim().slice(0, 400), category: t.category, who: t.who.trim().slice(0, 80), quote: (t.quote ?? "").trim().slice(0, 300) }))
    .filter((t) => t.term && !seen.has(key(t.term)) && seen.add(key(t.term)));
  await db.$transaction([
    db.vocabTerm.deleteMany({ where: { postId } }),
    db.vocabTerm.createMany({ data: rows, skipDuplicates: true }),
    db.post.update({ where: { id: postId }, data: { vocabAt: new Date() } }),
  ]);
}

export async function loadVocab(postId: string): Promise<VocabIn[]> {
  const rows = await db.vocabTerm.findMany({ where: { postId }, orderBy: { createdAt: "asc" } });
  return rows.map(({ term, definition, category, who, quote }) => ({ term, definition, category, who, quote }));
}
