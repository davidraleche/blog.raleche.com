import { slugify } from "./utils";

const NAME = /^[A-Z][a-zA-Z'.-]+(?: [A-Z][a-zA-Z'.-]+){1,2}$/;
const MONTH = /^(January|February|March|April|May|June|July|August|September|October|November|December)\b/;
const NOT_PEOPLE = /\b(AI|Labs?|Podcast|Combinator|Intelligence|Superintelligence|Capital|Partners|Inc|Group|Media|Show|Best|Engineered)\b/;

/** Guest, interviewer and show for an interview article, from its tags and intro. */
export function extractPeople({ tags, body }: { tags: string; body: string }) {
  const intro = body.replace(/^> Watch[^\n]*\n\n/, "").slice(0, 1200);
  const m = intro.match(/(?:conversation|interview|sits? down|sat down|talks?|chat)\s+with\s+(?:\w+(?: \w+){0,6}\s+)?\*\*([^*]+)\*\*(?:[^.]*?\bon\s+([A-Z][^,.]+?)(?:,|\.| published| on ))?/);
  const people = tags.split(",").map((t) => t.trim()).filter((t) => NAME.test(t) && !NOT_PEOPLE.test(t));
  let host = m?.[1].trim() ?? null;
  const rawShow = m?.[2]?.trim() ?? null;
  const show = rawShow && !MONTH.test(rawShow) ? rawShow.replace(/ on .*$/, "") : null;
  // "**Vivian Shen** sits down with **Paul Graham**": the bold name after "with" is the guest, the one before is the host.
  if (host && host === people[0] && m) {
    const before = intro.slice(0, m.index).match(/\*\*([^*]+)\*\*[^*]*$/)?.[1].trim();
    host = before && before !== host ? before : null;
  }
  const speaker = people.find((t) => t !== host && t !== show) ?? null;
  return { speaker, host, show };
}

export const personSlug = (name: string) => slugify(name);
