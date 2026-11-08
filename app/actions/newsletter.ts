"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/welcome-email";

export async function subscribeNewsletter(_: unknown, form: FormData) {
  const { t, locale } = await getI18n();
  const email = z.string().email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: t("invalidEmail") };
  const before = await db.subscriber.findUnique({ where: { email: email.data }, select: { status: true } });
  const sub = await db.subscriber.upsert({
    where: { email: email.data },
    create: { email: email.data, source: String(form.get("source") ?? "site"), language: locale },
    update: before?.status === "subscribed" ? {} : { status: "subscribed", language: locale },
  });
  // Welcome only new or returning subscribers, so resubmitting the form doesn't spam anyone.
  if (before?.status !== "subscribed") {
    try {
      const stories = await db.post.findMany({
        where: { status: "published" },
        orderBy: { publishedAt: "desc" },
        take: 3,
        select: { title: true, slug: true, dek: true },
      });
      const { subject, html } = welcomeEmail({ locale, unsubscribeKey: sub.unsubscribeKey, stories });
      if (!(await sendEmail(sub.email, subject, html))) console.error(`[newsletter] welcome email failed for subscriber ${sub.id}`);
    } catch (e) {
      console.error(`[newsletter] welcome email error for subscriber ${sub.id}: ${(e as Error).message}`);
    }
  }
  return { ok: true, message: t("onTheList") };
}
