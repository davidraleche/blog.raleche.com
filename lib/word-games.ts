import "server-only";
import crypto from "node:crypto";
import { db } from "./db";
import { translateMany } from "./translate";
import { getSpeakerQuotes } from "./quotes";
import type { Locale } from "./i18n/messages";

export type GameKind = "vocab" | "quote";
/** What the browser gets: the prompt and four choices. The right answer only travels inside the encrypted token. */
export type GameQuestion = { kind: GameKind; prompt: string; hint: string; options: string[]; token: string };
type Payload = { k: GameKind; a: number; s: string; r?: string; x?: string; n: string; e: number };

const key = () => crypto.createHash("sha256").update(`${process.env.SESSION_SECRET || "dev-secret"}:word-games`).digest();

function seal(p: Payload) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(p), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

export function openToken(token: string): Payload | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const p = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8")) as Payload;
    return p.e > Date.now() ? p : null;
  } catch {
    return null;
  }
}

const pick = <T,>(list: T[]) => list[crypto.randomInt(list.length)];
function shuffle<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Three wrong choices (distinct from the answer and each other), the answer placed at a random spot. */
function choices(answer: string, pool: string[]) {
  const norm = (s: string) => s.trim().toLowerCase();
  const wrong = shuffle([...new Set(pool.filter((x) => norm(x) !== norm(answer)))]).slice(0, 3);
  const options = shuffle([answer, ...wrong]);
  return { options, a: options.indexOf(answer) };
}
const ticket = (p: Omit<Payload, "n" | "e">) => seal({ ...p, n: crypto.randomBytes(8).toString("hex"), e: Date.now() + 6 * 3600e3 });

/** A random word from the articles' vocabulary with four definitions (the other three from other words, same kind when possible). */
export async function vocabQuestion(locale: Locale): Promise<GameQuestion | null> {
  const terms = await db.vocabTerm.findMany({ where: { post: { status: "published", publishedAt: { lte: new Date() } } }, select: { id: true, term: true, definition: true, category: true, post: { select: { slug: true } } } });
  if (terms.length < 4) return null;
  // Story first, then one of its words, so every interview gets its turn.
  const slugs = [...new Set(terms.map((t) => t.post.slug))];
  const slug = pick(slugs);
  const q = pick(terms.filter((t) => t.post.slug === slug));
  const same = terms.filter((t) => t.category === q.category && t.id !== q.id).map((t) => t.definition);
  const pool = same.length >= 3 ? same : terms.filter((t) => t.id !== q.id).map((t) => t.definition);
  const { options, a } = choices(q.definition, pool);
  const translated = await translateMany(locale, options);
  return { kind: "vocab", prompt: q.term, hint: q.category, options: options.map((o, i) => translated[i] || o), token: ticket({ k: "vocab", a, s: q.post.slug, r: q.id }) };
}

/** A random quote from the articles with four people who may have said it (the others are speakers from other stories). */
export async function quoteQuestion(locale: Locale): Promise<GameQuestion | null> {
  const all = await getSpeakerQuotes(locale);
  const speakers = [...new Set(all.map((q) => q.speaker))];
  // Lines that name one of the choices (e.g. "Andy Jassy, Amazon's CEO, ...") would give the answer away.
  const names = speakers.flatMap((s) => [s, s.split(" ").at(-1)!]).filter((n) => n.length > 2);
  const quotes = all.map((q, i) => ({ ...q, i })).filter((q) => !names.some((n) => q.text.includes(n)));
  if (!quotes.length) return null;
  if (speakers.length < 4) return null;
  // Speaker first, then one of their quotes, so stories with many quotes don't crowd out the rest.
  const who = pick([...new Set(quotes.map((q) => q.speaker))]);
  const q = pick(quotes.filter((x) => x.speaker === who));
  const { options, a } = choices(q.speaker, speakers);
  // The English original travels in the token so the answer can show the passage it came from.
  const en = locale === "en" ? all : await getSpeakerQuotes("en");
  return { kind: "quote", prompt: q.text, hint: "", options, token: ticket({ k: "quote", a, s: q.slug, x: en[q.i]?.text }) };
}

const plain = (md: string) =>
  md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/^#+\s*|^>\s*|^[-*]\s+/gm, "").replace(/[*_`]+/g, "").replace(/\s+/g, " ").trim();

/** The passage of the article a quote comes from: its paragraph (with the one before when it stands alone), in plain text. */
export function quoteExtract(body: string, quote: string): string | null {
  const paras = body.split(/\n\s*\n/);
  const i = paras.findIndex((p) => p.includes(quote));
  if (i < 0) return null;
  let text = plain(paras[i]);
  if (text.length < quote.length + 60 && i > 0 && !/^#/.test(paras[i - 1].trim())) text = `${plain(paras[i - 1])} ${text}`;
  if (text.length > 700) {
    const at = Math.max(0, text.indexOf(quote.slice(0, 40)) - 250);
    text = `${at > 0 ? "…" : ""}${text.slice(at, at + 650).trim()}…`;
  }
  return text;
}
