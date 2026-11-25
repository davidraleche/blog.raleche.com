// Newsletters. Monday/Wednesday briefing: latest stories, books from our guests, quizzes on new stories, most read,
// then the wheel. Tuesday/Thursday "Quotes & quiz": quotes from our guests, quizzes, 3 random books.
// No server-only imports, so scripts can render and send it too.
import type { PrismaClient } from "@prisma/client";
import { QUOTE_WHEEL_DAILY_MAX, QUIZ_REWARD } from "./token-config";
import { emailCover } from "./email-image";
import { emailLogo } from "./email-brand";
import { NO_BOOKS } from "./email-books";
import { communityBar } from "./community-email";
import { isLocale } from "./i18n/messages";
import { extractQuotes, isPersonName } from "./quote-extract";

type Story = { title: string; slug: string; dek: string; coverImage: string | null; readMinutes: number };
type QuizTeaser = Story & { question: string; options: string[] };
export type WeeklyContent = { quizzes: QuizTeaser[]; latest: Story[]; mostRead: (Story & { reads: number })[]; guests?: string[] };

const storySelect = { id: true, title: true, slug: true, dek: true, coverImage: true, readMinutes: true } as const;
const published = () => ({ status: "published", publishedAt: { lte: new Date() } });

export async function loadWeeklyContent(db: PrismaClient): Promise<WeeklyContent> {
  const latest = await db.post.findMany({ where: published(), orderBy: { publishedAt: "desc" }, take: 5, select: storySelect });

  // First question of each of the newest quizzes; the answer stays on the site.
  const withQuiz = await db.post.findMany({
    where: { ...published(), quiz: { isNot: null } },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: { ...storySelect, quiz: { select: { questions: true } } },
  });
  const quizzes = withQuiz.flatMap((p) => {
    const q = (p.quiz?.questions as { q: string; options: string[] }[] | undefined)?.[0];
    return q ? [{ ...p, question: q.q, options: q.options }] : [];
  });

  // Most read over the last 30 days, falling back to all-time views.
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const recent = await db.postView.groupBy({ by: ["postId"], where: { day: { gte: since } }, _sum: { count: true }, orderBy: { _sum: { count: "desc" } }, take: 5 });
  let mostRead: WeeklyContent["mostRead"];
  if (recent.length >= 3) {
    const posts = await db.post.findMany({ where: { ...published(), id: { in: recent.map((r) => r.postId) } }, select: storySelect });
    mostRead = recent.flatMap((r) => {
      const p = posts.find((x) => x.id === r.postId);
      return p ? [{ ...p, reads: r._sum.count ?? 0 }] : [];
    });
  } else {
    const posts = await db.post.findMany({ where: published(), orderBy: { views: "desc" }, take: 5, select: { ...storySelect, views: true } });
    mostRead = posts.map((p) => ({ ...p, reads: p.views }));
  }
  // Guests of the newest stories, for the subject line ("Andy Jassy, Satya Nadella & more").
  const speakers = await db.post.findMany({ where: { ...published(), speaker: { not: null } }, orderBy: { publishedAt: "desc" }, take: 10, select: { speaker: true } });
  const guests = [...new Set(speakers.map((p) => p.speaker!.trim()).filter(isPersonName))];
  return { quizzes, latest, mostRead, guests };
}

/** "Andy Jassy, Satya Nadella & more": the first two guests, kept short for inbox previews. */
function guestSnippet(guests: string[] = []) {
  if (!guests.length) return "";
  const two = guests.slice(0, 2).join(", ");
  return guests.length > 2 ? `${two} & more` : two;
}

/** Every fixed piece of text, numbers already filled in, so it can be machine-translated as plain strings. */
export function weeklyLabels() {
  return {
    briefing: "The weekly briefing",
    wheelHeading: "Spin the wheel",
    wheelTitle: `Win up to ${QUOTE_WHEEL_DAILY_MAX} tokens a day`,
    wheelDek: "Free spins, as many as you like: win tokens or a quote from our speakers. Tokens unlock executive summaries.",
    spinNow: "Spin now",
    quizHeading: "Quiz: this week's new stories",
    quizDek: `Read the summary, then get both questions right to win ${QUIZ_REWARD} tokens per story.`,
    answer: `Answer & win ${QUIZ_REWARD} tokens`,
    latestHeading: "The latest",
    booksHeading: "Books from our guests",
    minRead: "min read",
    mostReadHeading: "Most read",
    readMore: "Read more on Raleche",
    footer: "You get this because you subscribed to the Raleche briefing.",
    unsubscribe: "Unsubscribe",
    subject: "The IT Raleche's Briefing",
  };
}
export type WeeklyLabels = ReturnType<typeof weeklyLabels>;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SANS = "Helvetica,Arial,sans-serif";

function heading(n: number, title: string) {
  return `<tr><td style="padding:36px 0 12px"><div style="border-top:3px solid #111;padding-top:10px;font-family:${SANS};font-weight:800;font-size:22px;text-transform:uppercase;letter-spacing:-.3px;color:#111"><span style="color:#e1251b">${n}.</span> ${esc(title)}</div></td></tr>`;
}

function button(href: string, label: string, bg = "#111") {
  return `<a href="${href}" style="display:inline-block;background:${bg};color:#fff;padding:13px 22px;text-decoration:none;font-family:${SANS};font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">${esc(label)}</a>`;
}

/** `books` is the reading-list box (emailBooksBlock), placed after the latest stories instead of at the end. */
export function weeklyNewsletter(content: WeeklyContent, opts: { unsubscribeKey?: string; date?: Date; labels?: WeeklyLabels; locale?: string; books?: string } = {}) {
  const L = opts.labels ?? weeklyLabels();
  // Section numbers follow the order they appear in; empty sections are skipped.
  const order = ["latest", ...(opts.books ? ["books"] : []), ...(content.quizzes.length ? ["quiz"] : []), "mostRead", "wheel"];
  const num = (k: string) => order.indexOf(k) + 1;
  const url = (process.env.APP_URL || "https://raleche.com").replace(/\/$/, "");
  const story = (s: { slug: string }, hash = "") => `${url}/story/${encodeURIComponent(s.slug)}${hash}`;
  const lang = isLocaleOr(opts.locale?.slice(0, 2)); // "fr-FR" → "fr"
  const date = (opts.date ?? new Date()).toLocaleDateString(opts.locale ?? "en-US", { month: "long", day: "numeric", year: "numeric" });

  const wheel = `${heading(num("wheel"), L.wheelHeading)}
<tr><td style="background:#111;color:#fff;padding:26px 24px;text-align:center">
<div style="font-size:44px;line-height:1">🎡</div>
<div style="font-family:${SANS};font-weight:800;font-size:26px;text-transform:uppercase;margin-top:10px">${esc(L.wheelTitle)}</div>
<div style="font-size:16px;color:#ccc;margin:8px 0 18px">${esc(L.wheelDek)}</div>
${button(`${url}/?spin=1`, L.spinNow, "#e1251b")}
</td></tr>`;

  const quizzes = quizSection(content.quizzes, num("quiz"), L, story);

  const latest = `${heading(num("latest"), L.latestHeading)}
${content.latest
  .map(
    (s, i) => `<tr><td style="padding:14px 0;border-bottom:1px solid #e5e5e5">
${i === 0 && s.coverImage ? `<div style="margin-bottom:12px">${emailCover(s.coverImage, story(s), 560, s.title)}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="vertical-align:top">
<a href="${story(s)}" style="color:#111;text-decoration:none;font-family:${SANS};font-weight:800;font-size:${i === 0 ? 24 : 18}px;line-height:1.2;text-transform:uppercase">${esc(s.title)}</a>
${s.dek ? `<div style="color:#555;font-size:15px;margin-top:6px">${esc(s.dek)}</div>` : ""}
<div style="font-family:${SANS};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#999;margin-top:6px">${s.readMinutes} ${esc(L.minRead)}</div>
</td>${i > 0 && s.coverImage ? `<td style="vertical-align:top;width:152px;padding-left:12px">${emailCover(s.coverImage, story(s), 140, s.title)}</td>` : ""}</tr></table>
</td></tr>`,
  )
  .join("")}`;

  const mostRead = `${heading(num("mostRead"), L.mostReadHeading)}
${content.mostRead
  .map(
    (s, i) => `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e5e5">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td style="vertical-align:top;width:44px;font-family:${SANS};font-weight:800;font-size:34px;line-height:1;color:#e1251b">${i + 1}</td>
<td style="vertical-align:top"><a href="${story(s)}" style="color:#111;text-decoration:none;font-family:${SANS};font-weight:800;font-size:17px;line-height:1.25;text-transform:uppercase">${esc(s.title)}</a></td>
${s.coverImage ? `<td style="vertical-align:top;width:112px;padding-left:12px">${emailCover(s.coverImage, story(s), 100, s.title)}</td>` : ""}
</tr></table></td></tr>`,
  )
  .join("")}`;

  const books = opts.books ? `${heading(num("books"), L.booksHeading)}
<tr><td>${opts.books}</td></tr>` : "";

  const body = `<!--sec:latest-->${latest}
<!--sec:books-->${books}
<!--sec:quiz-->${quizzes}
<!--sec:most-read-->${mostRead}
<!--sec:wheel-->${wheel}`;
  return emailShell({ kind: "briefing", body, L, lang, date, url, guests: content.guests, books: opts.books, unsubscribeKey: opts.unsubscribeKey, when: opts.date });
}

/** Quiz section: the first question of each story, every answer links to the quiz on the site. */
function quizSection(quizzes: QuizTeaser[], n: number, L: { quizHeading: string; quizDek: string; answer: string }, story: (s: { slug: string }, hash?: string) => string) {
  if (!quizzes.length) return "";
  return `${heading(n, L.quizHeading)}
<tr><td style="font-size:16px;color:#555;padding-bottom:6px">${esc(L.quizDek)}</td></tr>
${quizzes
  .map(
    (q) => `<tr><td style="padding:16px 0;border-bottom:1px solid #e5e5e5">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
${q.coverImage ? `<td style="vertical-align:top;width:132px;padding-right:12px">${emailCover(q.coverImage, story(q), 120, q.title)}</td>` : ""}
<td style="vertical-align:top;font-family:${SANS};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#e1251b">${esc(q.title)}</td>
</tr></table>
<div style="font-weight:bold;font-size:19px;line-height:1.35;margin:6px 0 10px">${esc(q.question)}</div>
${q.options.map((o, i) => `<a href="${story(q, "#quiz")}" style="display:block;border:1px solid #111;padding:9px 12px;margin-bottom:6px;color:#111;text-decoration:none;font-family:${SANS};font-size:15px"><b>${"ABCD"[i]}.</b> ${esc(o)}</a>`).join("")}
<div style="margin-top:10px">${button(story(q, "#quiz"), L.answer)}</div>
</td></tr>`,
  )
  .join("")}`;
}

/** Logo, date, WhatsApp/LinkedIn strip, the sections, "read more", community box slot and unsubscribe; links tagged. */
function emailShell(o: {
  kind: "briefing" | "quotes";
  body: string;
  L: { briefing: string; readMore: string; footer: string; unsubscribe: string; subject: string };
  lang: ReturnType<typeof isLocaleOr>;
  date: string;
  url: string;
  guests?: string[];
  books?: string;
  unsubscribeKey?: string;
  when?: Date;
}) {
  const { L, url } = o;
  const raw = `${o.books !== undefined ? NO_BOOKS : ""}<div style="background:#f4f4f4;padding:20px 0">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fff;font-family:Georgia,serif;font-size:17px;line-height:1.55;color:#111">
<tr><td style="padding:18px 20px 14px;border-bottom:3px solid #111">${emailLogo()}
<div style="font-family:${SANS};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#666;margin-top:8px">${esc(L.briefing)} · ${esc(o.date)}</div></td></tr>
<tr><td style="padding:12px 20px;background:#fafafa;border-bottom:1px solid #e5e5e5;text-align:center">${communityBar(o.lang)}</td></tr>
<tr><td style="padding:0 20px 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">
${o.body}
<!--sec:read-more--><tr><td style="padding-top:30px;text-align:center">${button(url, L.readMore)}</td></tr>
</table></td></tr>
<!--sec:end--><!--community-row-->
<tr><td style="padding:16px 20px;border-top:1px solid #e5e5e5;font-family:${SANS};font-size:12px;color:#888">${esc(L.footer)}<br><a href="${url}/unsubscribe?key=${encodeURIComponent(o.unsubscribeKey ?? "test")}" style="color:#555">${esc(L.unsubscribe)}</a></td></tr>
</table></div>`;

  const html = tagLinks(raw, url, `${o.kind}-${(o.when ?? new Date()).toISOString().slice(0, 10)}`);

  // "The IT Raleche's Briefing — Andy Jassy, Satya Nadella & more 11/23/26"
  const short = (o.when ?? new Date()).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit", timeZone: "America/New_York" });
  const who = guestSnippet(o.guests);
  return { subject: `${L.subject} — ${who ? `${who} ` : ""}${short}`, html };
}

const isLocaleOr = (l: string | undefined) => (isLocale(l) ? l : "en");

// ---------------------------------------------------------------------------------------------------------------
// Tuesday/Thursday edition: quotes from our guests, quizzes, 3 random books, and the WhatsApp/LinkedIn boxes.

type QuoteItem = { text: string; speaker: string; slug: string; title: string; coverImage: string | null };
export type QuotesContent = { quotes: QuoteItem[]; quizzes: QuizTeaser[]; guests?: string[] };

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

/** Five quotes from five different guests and three quizzes, picked at random so every edition differs. */
export async function loadQuotesContent(db: PrismaClient): Promise<QuotesContent> {
  const posts = await db.post.findMany({ where: { ...published(), speaker: { not: null } }, select: { slug: true, title: true, speaker: true, body: true, coverImage: true } });
  const seen = new Set<string>();
  const quotes: QuoteItem[] = [];
  for (const p of shuffle(posts)) {
    if (!isPersonName(p.speaker) || seen.has(p.speaker)) continue;
    // Skip "quotes" that are really a headline (they name the speaker or repeat the title).
    const q = shuffle(extractQuotes(p.body).filter((t) => !t.includes(p.speaker!) && !p.title.includes(t.slice(0, 30))))[0];
    if (!q) continue;
    seen.add(p.speaker);
    quotes.push({ text: q, speaker: p.speaker, slug: p.slug, title: p.title, coverImage: p.coverImage });
    if (quotes.length === 5) break;
  }
  const withQuiz = await db.post.findMany({ where: { ...published(), quiz: { isNot: null } }, select: { ...storySelect, quiz: { select: { questions: true } } } });
  const quizzes = shuffle(withQuiz).slice(0, 3).flatMap((p) => {
    const q = shuffle((p.quiz?.questions as { q: string; options: string[] }[] | undefined) ?? [])[0];
    return q ? [{ id: p.id, title: p.title, slug: p.slug, dek: p.dek, coverImage: p.coverImage, readMinutes: p.readMinutes, question: q.q, options: q.options }] : [];
  });
  return { quotes, quizzes, guests: quotes.map((q) => q.speaker) };
}

export function quotesLabels() {
  return {
    briefing: "Quotes & quiz",
    quotesHeading: "What our guests said",
    quotesDek: "Lines from our interviews worth keeping. Tap one to read the full story.",
    readStory: "Read the story",
    quizHeading: "Quiz: test yourself",
    quizDek: `Read the summary, then get both questions right to win ${QUIZ_REWARD} tokens per story.`,
    answer: `Answer & win ${QUIZ_REWARD} tokens`,
    booksHeading: "Books from our guests",
    readMore: "Read more on Raleche",
    footer: "You get this because you subscribed to the Raleche briefing.",
    unsubscribe: "Unsubscribe",
    subject: "The IT Raleche's Quotes & Quiz",
  };
}
export type QuotesLabels = ReturnType<typeof quotesLabels>;

/** `books` is the reading-list box (emailBooksBlock with 3 random books). */
export function quotesNewsletter(content: QuotesContent, opts: { unsubscribeKey?: string; date?: Date; labels?: QuotesLabels; locale?: string; books?: string } = {}) {
  const L = opts.labels ?? quotesLabels();
  const order = ["quotes", ...(content.quizzes.length ? ["quiz"] : []), ...(opts.books ? ["books"] : [])];
  const num = (k: string) => order.indexOf(k) + 1;
  const url = (process.env.APP_URL || "https://raleche.com").replace(/\/$/, "");
  const story = (s: { slug: string }, hash = "") => `${url}/story/${encodeURIComponent(s.slug)}${hash}`;
  const lang = isLocaleOr(opts.locale?.slice(0, 2));
  const date = (opts.date ?? new Date()).toLocaleDateString(opts.locale ?? "en-US", { month: "long", day: "numeric", year: "numeric" });

  const quotes = `${heading(num("quotes"), L.quotesHeading)}
<tr><td style="font-size:16px;color:#555;padding-bottom:6px">${esc(L.quotesDek)}</td></tr>
${content.quotes
  .map(
    (q) => `<tr><td style="padding:18px 0;border-bottom:1px solid #e5e5e5">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="vertical-align:top">
<div style="font-family:Georgia,serif;font-size:42px;line-height:.6;color:#e1251b">“</div>
<a href="${story(q)}" style="color:#111;text-decoration:none;font-family:Georgia,serif;font-style:italic;font-size:20px;line-height:1.4">${esc(q.text)}</a>
<div style="font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#111;margin-top:10px">— ${esc(q.speaker)}</div>
<div style="margin-top:4px"><a href="${story(q)}" style="font-family:${SANS};font-size:13px;color:#e1251b;font-weight:bold;text-decoration:none">${esc(L.readStory)} →</a></div>
</td>${q.coverImage ? `<td style="vertical-align:top;width:112px;padding-left:12px">${emailCover(q.coverImage, story(q), 100, q.title)}</td>` : ""}</tr></table>
</td></tr>`,
  )
  .join("")}`;

  const quizzes = quizSection(content.quizzes, num("quiz"), L, story);
  const books = opts.books ? `${heading(num("books"), L.booksHeading)}
<tr><td>${opts.books}</td></tr>` : "";
  const body = `<!--sec:quotes-->${quotes}
<!--sec:quiz-->${quizzes}
<!--sec:books-->${books}`;
  return emailShell({ kind: "quotes", body, L, lang, date, url, guests: content.guests, books: opts.books, unsubscribeKey: opts.unsubscribeKey, when: opts.date });
}

/**
 * Every link to the site gets ?utm_source=newsletter&utm_medium=email&utm_campaign=briefing-2026-11-25&utm_content=<section>,
 * so the admin's Visitors page shows visits from the newsletter, which edition and which part of it (header, latest, books,
 * quiz, most-read, wheel, read-more). Sections are marked <!--sec:name--> in the template; the unsubscribe link stays plain.
 */
function tagLinks(html: string, site: string, campaign: string) {
  let section = "header";
  return html.split(/(<!--sec:[\w-]+-->)/).map((part) => {
    const m = part.match(/^<!--sec:([\w-]+)-->$/);
    if (m) {
      section = m[1];
      return "";
    }
    if (section === "end") return part;
    return part.replace(/href="([^"]+)"/g, (all, href: string) => {
      if (!href.startsWith(site) || href.includes("/unsubscribe")) return all;
      const [base, hash] = href.split("#");
      const q = `utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=${campaign}&amp;utm_content=${section}`;
      return `href="${base}${base.includes("?") ? "&amp;" : "?"}${q}${hash !== undefined ? `#${hash}` : ""}"`;
    });
  }).join("");
}
