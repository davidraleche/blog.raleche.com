"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";

export async function subscribeNewsletter(_: unknown, form: FormData) {
  const { t } = await getI18n();
  const email = z.string().email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: t("invalidEmail") };
  await db.subscriber.upsert({
    where: { email: email.data },
    create: { email: email.data, source: String(form.get("source") ?? "site") },
    update: { status: "subscribed" },
  });
  return { ok: true, message: t("onTheList") };
}
