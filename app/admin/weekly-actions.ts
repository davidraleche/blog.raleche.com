"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { isLocale, type Locale } from "@/lib/i18n/messages";
import { fillBookPitches } from "@/lib/book-pitch";
import { loadWeeklyContent } from "@/lib/weekly-newsletter";
import { sendBriefingToAll, weeklyIn } from "@/lib/weekly-send";

export async function sendWeeklyTest() {
  const admin = await requireAdmin();
  await fillBookPitches().catch(() => 0); // books without a "why read it" pitch get one before sending
  const lang: Locale = isLocale(admin.language) ? admin.language : "en";
  const build = await weeklyIn(lang, await loadWeeklyContent(db));
  const { subject, html } = build();
  if (admin.email) await sendEmail(admin.email, `[TEST] ${subject}`, html, [], lang);
  redirect("/admin/newsletter?weekly=test");
}

export async function sendWeekly(form: FormData) {
  await requireAdmin();
  if (form.get("confirm") !== "yes") redirect("/admin/newsletter?weekly=confirm");
  const { sent } = await sendBriefingToAll(db);
  redirect(`/admin/newsletter?weekly=sent&n=${sent}`);
}
