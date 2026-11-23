// Weekly newsletter: latest stories, books from our guests, quizzes on new stories, most read, then the wheel.
// No server-only imports, so scripts can render and send it too.
import type { PrismaClient } from "@prisma/client";
import { QUOTE_WHEEL_DAILY_MAX, QUIZ_REWARD } from "./token-config";
import { emailCover } from "./email-image";
import { emailLogo } from "./email-brand";
import { NO_BOOKS } from "./email-books";

type Story = { title: string; slug: string; dek: string; coverImage: string | null; readMinutes: number };
type QuizTeaser = Story & { question: string; options: string[] };
export type WeeklyContent = { quizzes: QuizTeaser[]; latest: Story[]; mostRead: (Story & { reads: number })[] };

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
  return { quizzes, latest, mostRead };
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
    subject: "The Raleche Briefing",
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
  const date = (opts.date ?? new Date()).toLocaleDateString(opts.locale ?? "en-US", { month: "long", day: "numeric", year: "numeric" });

  const wheel = `${heading(num("wheel"), L.wheelHeading)}
<tr><td style="background:#111;color:#fff;padding:26px 24px;text-align:center">
<div style="font-size:44px;line-height:1">🎡</div>
<div style="font-family:${SANS};font-weight:800;font-size:26px;text-transform:uppercase;margin-top:10px">${esc(L.wheelTitle)}</div>
<div style="font-size:16px;color:#ccc;margin:8px 0 18px">${esc(L.wheelDek)}</div>
${button(`${url}/?spin=1`, L.spinNow, "#e1251b")}
</td></tr>`;

  const quizzes = content.quizzes.length
    ? `${heading(num("quiz"), L.quizHeading)}
<tr><td style="font-size:16px;color:#555;padding-bottom:6px">${esc(L.quizDek)}</td></tr>
${content.quizzes
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
  .join("")}`
    : "";

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

  const html = `${opts.books !== undefined ? NO_BOOKS : ""}<div style="background:#f4f4f4;padding:20px 0">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fff;font-family:Georgia,serif;font-size:17px;line-height:1.55;color:#111">
<tr><td style="padding:18px 20px 14px;border-bottom:3px solid #111">${emailLogo()}
<div style="font-family:${SANS};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#666;margin-top:8px">${esc(L.briefing)} · ${esc(date)}</div></td></tr>
<tr><td style="padding:0 20px 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">
${latest}
${books}
${quizzes}
${mostRead}
${wheel}
<tr><td style="padding-top:30px;text-align:center">${button(url, L.readMore)}</td></tr>
</table></td></tr>
<!--community-row-->
<tr><td style="padding:16px 20px;border-top:1px solid #e5e5e5;font-family:${SANS};font-size:12px;color:#888">${esc(L.footer)}<br><a href="${url}/unsubscribe?key=${encodeURIComponent(opts.unsubscribeKey ?? "test")}" style="color:#555">${esc(L.unsubscribe)}</a></td></tr>
</table></div>`;

  return { subject: `${L.subject} — ${date}`, html };
}
