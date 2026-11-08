"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, hashPassword, verifyPassword, adminEmail, currentSessionId } from "@/lib/auth";
import { issueCode, verifyOtp } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import { stripe } from "@/lib/stripe";
import { getI18n } from "@/lib/i18n/server";
import { isLocale } from "@/lib/i18n/messages";

export type FormState = { ok?: string; error?: string; step?: "code"; email?: string } | null;

async function syncStripeCustomer(customerId: string | null, data: { name?: string; email?: string }) {
  if (stripe && customerId) await stripe.customers.update(customerId, data).catch(() => null);
}

export async function saveName(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const { t } = await getI18n();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: t("enterName") };
  await db.user.update({ where: { id: user.id }, data: { name } });
  await syncStripeCustomer(user.stripeCustomerId, { name });
  revalidatePath("/account", "layout");
  return { ok: t("nameSaved") };
}

/** Two steps: send a code to the new address, then confirm it. The email only changes once the code is entered. */
export async function changeEmail(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const { t } = await getI18n();
  const parsed = z.string().email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: t("invalidEmail") };
  const email = parsed.data;
  if (email === user.email) return { error: t("alreadyYourEmail") };
  if (email === adminEmail()) return { error: t("emailNotAllowed") };
  if (await db.user.findUnique({ where: { email } })) return { error: t("emailTaken") };
  const key = `email-change:${user.id}:${email}`;

  const code = String(form.get("code") ?? "").trim();
  if (!code) {
    if (process.env.NODE_ENV === "production" && !process.env.RESEND_API_KEY) return { error: t("emailChangeUnavailable") };
    try {
      const c = await issueCode(key);
      await sendEmail(email, t("codeEmailSubject", { code: c }), `<p>${t("codeEmailBody", { code: `<b>${c}</b>` })}</p>`);
    } catch (e) {
      return { error: (e as Error).message };
    }
    return { step: "code", email };
  }
  if (!(await verifyOtp(key, code))) return { step: "code", email, error: t("codeWrong") };
  await db.user.update({ where: { id: user.id }, data: { email } });
  await syncStripeCustomer(user.stripeCustomerId, { email });
  revalidatePath("/account", "layout");
  return { ok: t("emailChanged", { email }) };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const { t } = await getI18n();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  if (next.length < 8) return { error: t("newPasswordMin") };
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) return { error: t("currentPasswordWrong") };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  // Sign out other devices.
  const keep = await currentSessionId();
  await db.session.deleteMany({ where: { userId: user.id, ...(keep ? { NOT: { id: keep } } : {}) } });
  revalidatePath("/account/profile");
  return { ok: user.passwordHash ? t("passwordChanged") : t("passwordSet") };
}

/** Preferred language for newsletters and emails. Also applied to the newsletter subscription, if any. */
export async function saveLanguage(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const { t } = await getI18n();
  const language = String(form.get("language") ?? "");
  if (!isLocale(language)) return { error: "Unknown language" };
  await db.user.update({ where: { id: user.id }, data: { language } });
  if (user.email) await db.subscriber.updateMany({ where: { email: user.email }, data: { language } });
  revalidatePath("/account/profile");
  return { ok: t("languageSaved") };
}
