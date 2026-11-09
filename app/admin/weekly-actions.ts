"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { translateMany } from "@/lib/translate";
import { isLocale, type Locale } from "@/lib/i18n/messages";
import { loadWeeklyContent, weeklyLabels, weeklyNewsletter, type WeeklyContent, type WeeklyLabels } from "@/lib/weekly-newsletter";

const DATE_LOCALE: Record<Locale, string> = { en: "en-US", fr: "fr-FR", es: "es-ES", zh: "zh-CN" };

/** The weekly briefing in one language: fixed labels and story text machine-translated (cached). */
async function weeklyIn(lang: Locale, content: WeeklyContent) {
  const labels = weeklyLabels();
  if (lang === "en") return (key?: string) => weeklyNewsletter(content, { labels, unsubscribeKey: key });

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
  const localized = { quizzes, latest, mostRead };
  return (key?: string) => weeklyNewsletter(localized, { labels: tLabels, unsubscribeKey: key, locale: DATE_LOCALE[lang] });
}

export async function sendWeeklyTest() {
  const admin = await requireAdmin();
  const lang: Locale = isLocale(admin.language) ? admin.language : "en";
  const build = await weeklyIn(lang, await loadWeeklyContent(db));
  const { subject, html } = build();
  if (admin.email) await sendEmail(admin.email, `[TEST] ${subject}`, html);
  redirect("/admin/newsletter?weekly=test");
}

export async function sendWeekly(form: FormData) {
  await requireAdmin();
  if (form.get("confirm") !== "yes") redirect("/admin/newsletter?weekly=confirm");
  const content = await loadWeeklyContent(db);
  const subs = await db.subscriber.findMany({ where: { status: "subscribed" } });
  const builders = new Map<Locale, Awaited<ReturnType<typeof weeklyIn>>>();
  let sent = 0;
  let subject = "";
  for (const s of subs) {
    const lang: Locale = isLocale(s.language) ? s.language : "en";
    if (!builders.has(lang)) builders.set(lang, await weeklyIn(lang, content));
    const email = builders.get(lang)!(s.unsubscribeKey);
    if (lang === "en") subject = email.subject;
    if (await sendEmail(s.email, email.subject, email.html)) sent++;
  }
  // Keep a record in the campaign history.
  await db.campaign.create({
    data: { subject: subject || weeklyNewsletter(content).subject, body: "_Weekly briefing template: daily wheel, quizzes on new stories, latest, most read._", status: "sent", sentCount: sent, sentAt: new Date() },
  });
  redirect(`/admin/newsletter?weekly=sent&n=${sent}`);
}
