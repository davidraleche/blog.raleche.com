// Quoted sentences in a story's text, and whether a story's "speaker" is a person. Shared by the quote wheel
// (lib/quotes.ts) and the Tuesday/Thursday quotes newsletter. No server-only imports, so scripts can use it.

/** Complete quoted sentences (50–220 characters, starting with a capital, ending with . ! or ?). */
export function extractQuotes(body: string): string[] {
  return [...body.matchAll(/_?[“"]([^"”\n]{50,220})[”"]_?/g)]
    .map((m) => m[1].replace(/^[_\s]+|[_\s]+$/g, ""))
    .filter((q) => /^[A-Z]/.test(q) && /[.!?]$/.test(q));
}

// Some imported videos carry the channel's name as the speaker ("System Design", "Machine Learning", "Red Team").
const NOT_A_PERSON = /\b(design|learning|team|security|academy|code|coding|data|cloud|tech|engineering|ai|school|labs?|channel|tv|podcast|show|news|university|course|explained|systems?|crash|devops|programming|hub|official)\b/i;

/** True for a person's name like "Sam Altman", false for a channel or topic name. */
export function isPersonName(name: string | null | undefined): name is string {
  const n = (name ?? "").trim();
  return !!n && n.split(/\s+/).length <= 4 && !NOT_A_PERSON.test(n);
}
