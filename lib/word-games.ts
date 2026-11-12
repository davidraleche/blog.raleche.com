import "server-only";
import crypto from "node:crypto";
import { db } from "./db";
import { translateMany } from "./translate";
import { getSpeakerQuotes } from "./quotes";
import type { Locale } from "./i18n/messages";

export type GameKind = "vocab" | "quote";
/**
 * What the browser gets: the prompt and four choices. The right answer only travels inside the encrypted token.
 * `ref` names this exact question (same word or quote, same A-D order): /vocabulary?q=<ref> or /quotes?q=<ref> opens it again.
 */
export type GameQuestion = { kind: GameKind; prompt: string; hint: string; options: string[]; token: string; ref: string };
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
/** A repeatable random generator (mulberry32): the same seed always gives the same choices, so a shared link shows the same question. */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(list: T[], rnd: () => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Three wrong choices (distinct from the answer and each other), the answer placed at a spot set by the seed. */
function choices(answer: string, pool: string[], seed: number) {
  const rnd = seeded(seed);
  const norm = (s: string) => s.trim().toLowerCase();
  const wrong = seededShuffle([...new Set(pool.filter((x) => norm(x) !== norm(answer)))].sort(), rnd).slice(0, 3);
  const options = seededShuffle([answer, ...wrong], rnd);
  return { options, a: options.indexOf(answer) };
}
const newSeed = () => crypto.randomInt(0, 2 ** 31);
/** "<id>.<seed>": the seed part of a question ref, or a fresh one. */
function parseRef(ref: string | undefined) {
  const m = /^(.+)\.([0-9a-z]{1,7})$/.exec(ref ?? "");
  return m ? { id: m[1], seed: parseInt(m[2], 36) } : null;
}
const quoteId = (slug: string, enText: string) => `${slug}.${crypto.createHash("sha256").update(enText).digest("hex").slice(0, 8)}`;
const ticket = (p: Omit<Payload, "n" | "e">) => seal({ ...p, n: crypto.randomBytes(8).toString("hex"), e: Date.now() + 6 * 3600e3 });

/** A random word from the articles' vocabulary with four definitions (the other three from other words, same kind when possible). */
export async function vocabQuestion(locale: Locale, ref?: string): Promise<GameQuestion | null> {
  const terms = await db.vocabTerm.findMany({ where: { post: { status: "published", publishedAt: { lte: new Date() } } }, select: { id: true, term: true, definition: true, category: true, post: { select: { slug: true } } } });
  if (terms.length < 4) return null;
  // A shared link (?q=<term id>.<seed>) opens that word with the same choices; otherwise story first, then one of its words, so every interview gets its turn.
  const asked = parseRef(ref);
  const shared = asked && terms.find((t) => t.id === asked.id);
  const q = shared || pick(terms.filter((t) => t.post.slug === pick([...new Set(terms.map((t) => t.post.slug))])));
  const seed = shared ? asked.seed : newSeed();
  const same = terms.filter((t) => t.category === q.category && t.id !== q.id).map((t) => t.definition);
  const pool = same.length >= 3 ? same : terms.filter((t) => t.id !== q.id).map((t) => t.definition);
  const { options, a } = choices(q.definition, pool, seed);
  const translated = await translateMany(locale, options);
  return { kind: "vocab", prompt: q.term, hint: q.category, options: options.map((o, i) => translated[i] || o), token: ticket({ k: "vocab", a, s: q.post.slug, r: q.id }), ref: `${q.id}.${seed.toString(36)}` };
}

/** A random quote from the articles with four people who may have said it (the others are speakers from other stories). */
export async function quoteQuestion(locale: Locale, ref?: string): Promise<GameQuestion | null> {
  const all = await getSpeakerQuotes(locale);
  const speakers = [...new Set(all.map((q) => q.speaker))];
  // Lines that name one of the choices (e.g. "Andy Jassy, Amazon's CEO, ...") would give the answer away.
  const names = speakers.flatMap((s) => [s, s.split(" ").at(-1)!]).filter((n) => n.length > 2);
  const quotes = all.map((q, i) => ({ ...q, i })).filter((q) => !names.some((n) => q.text.includes(n)));
  if (!quotes.length) return null;
  if (speakers.length < 4) return null;
  // The English original travels in the token so the answer can show the passage it came from (and names the quote in shared links).
  const en = locale === "en" ? all : await getSpeakerQuotes("en");
  // A shared link (?q=<slug>.<hash>.<seed>) opens that quote with the same choices; otherwise speaker first, then one of
  // their quotes, so stories with many quotes don't crowd out the rest.
  const asked = parseRef(ref);
  const shared = asked && quotes.find((x) => en[x.i] && quoteId(x.slug, en[x.i].text) === asked.id);
  const q = shared || (() => { const who = pick([...new Set(quotes.map((x) => x.speaker))]); return pick(quotes.filter((x) => x.speaker === who)); })();
  const seed = shared ? asked.seed : newSeed();
  const { options, a } = choices(q.speaker, speakers, seed);
  const enText = en[q.i]?.text ?? q.text;
  return { kind: "quote", prompt: q.text, hint: "", options, token: ticket({ k: "quote", a, s: q.slug, x: en[q.i]?.text }), ref: `${quoteId(q.slug, enText)}.${seed.toString(36)}` };
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
