// Sending the briefing to every subscriber, in their language. Used by the admin "Send to N" button
// (app/admin/weekly-actions.ts) and by the Monday/Wednesday 9am Eastern schedule (scripts/send-weekly.ts,
// Cloud Run job "newsletter" started by Cloud Scheduler). No server-only imports, so scripts can run it.
import type { PrismaClient } from "@prisma/client";
import { translateMany } from "./translate";
import { isLocale, type Locale } from "./i18n/messages";
import { emailBooksBlock } from "./email-books";
import { fillBookPitches } from "./book-pitch";
import { withCommunity } from "./community-email";
import { withLogo } from "./email-brand";
import { loadWeeklyContent, weeklyLabels, weeklyNewsletter, type WeeklyContent, type WeeklyLabels } from "./weekly-newsletter";

const DATE_LOCALE: Record<Locale, string> = { en: "en-US", fr: "fr-FR", es: "es-ES", zh: "zh-CN" };
const CAMPAIGN_BODY = "_Weekly briefing template: latest, books from our guests, quizzes on new stories, most read, wheel._";

/** The weekly briefing in one language: fixed labels and story text machine-translated (cached). */
export async function weeklyIn(lang: Locale, content: WeeklyContent) {
  const labels = weeklyLabels();
  const books = await emailBooksBlock(lang);
  if (lang === "en") return (key?: string) => weeklyNewsletter(content, { labels, unsubscribeKey: key, books });

  const labelKeys = Object.keys(labels) as (keyof WeeklyLabels)[];
  const stories = [...content.quizzes, ...content.latest, ...content.mostRead];
  const texts = [
    ...labelKeys.map((k) => labels[k]),
    ...stories.flatMap((s) => [s.title, s.dek]),
    ...content.quizzes.flatMap((q) => [q.question, ...q.options]),
  ];
  const out = await translateMany(lang, texts);
  let i = 0;
  const next = () => out[i++];
  const tLabels = Object.fromEntries(labelKeys.map((k) => [k, next()])) as WeeklyLabels;
  const tStory = <T extends { title: string; dek: string }>(s: T): T => ({ ...s, title: next(), dek: next() });
  const quizzes = content.quizzes.map(tStory);
  const latest = content.latest.map(tStory);
  const mostRead = content.mostRead.map(tStory);
  for (const q of quizzes) Object.assign(q, { question: next(), options: q.options.map(() => next()) });
  const localized = { quizzes, latest, mostRead, guests: content.guests };
  return (key?: string) => weeklyNewsletter(localized, { labels: tLabels, unsubscribeKey: key, locale: DATE_LOCALE[lang], books });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One email through Resend, retrying when rate-limited. Same wrapping as lib/email.ts (books box is already inside). */
async function deliver(to: string, subject: string, body: string, lang: Locale) {
  const key = process.env.RESEND_API_KEY;
  const html = withLogo(withCommunity(body, lang));
  if (!key) {
    console.log(`[email:dev] to=${to} subject=${subject}`);
    return true;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "Raleche <newsletter@raleche.com>", to, subject, html }),
    });
    if (res.ok) return true;
    console.log(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    if (res.status !== 429 && res.status < 500) return false;
    await sleep(2000);
  }
  return false;
}

/** When the last briefing went out, so the schedule never sends twice in a row by mistake. */
export async function lastBriefingAt(db: PrismaClient) {
  const last = await db.campaign.findFirst({ where: { body: CAMPAIGN_BODY, status: "sent" }, orderBy: { sentAt: "desc" }, select: { sentAt: true } });
  return last?.sentAt ?? null;
}

/** Send the briefing to every subscriber, about 1.5 a second (Resend allows 2), and record the campaign. */
export async function sendBriefingToAll(db: PrismaClient) {
  await fillBookPitches().catch(() => 0); // books without a "why read it" pitch get one before sending
  const content = await loadWeeklyContent(db);
  const subs = await db.subscriber.findMany({ where: { status: "subscribed" }, orderBy: { createdAt: "asc" } });
  const builders = new Map<Locale, Awaited<ReturnType<typeof weeklyIn>>>();
  let sent = 0;
  let subject = "";
  for (const s of subs) {
    const lang: Locale = isLocale(s.language) ? s.language : "en";
    if (!builders.has(lang)) builders.set(lang, await weeklyIn(lang, content));
    const email = builders.get(lang)!(s.unsubscribeKey);
    if (lang === "en" || !subject) subject = email.subject;
    if (await deliver(s.email, email.subject, email.html, lang)) sent++;
    await sleep(650);
  }
  await db.campaign.create({ data: { subject: subject || weeklyNewsletter(content).subject, body: CAMPAIGN_BODY, status: "sent", sentCount: sent, sentAt: new Date() } });
  return { sent, total: subs.length, subject };
}
