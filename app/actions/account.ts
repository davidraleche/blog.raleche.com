"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, hashPassword, verifyPassword, adminEmail, currentSessionId } from "@/lib/auth";
import { issueCode, verifyOtp } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import { stripe } from "@/lib/stripe";

export type FormState = { ok?: string; error?: string; step?: "code"; email?: string } | null;

async function syncStripeCustomer(customerId: string | null, data: { name?: string; email?: string }) {
  if (stripe && customerId) await stripe.customers.update(customerId, data).catch(() => null);
}

export async function saveName(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Enter your name." };
  await db.user.update({ where: { id: user.id }, data: { name } });
  await syncStripeCustomer(user.stripeCustomerId, { name });
  revalidatePath("/account", "layout");
  return { ok: "Name saved." };
}

/** Two steps: send a code to the new address, then confirm it. The email only changes once the code is entered. */
export async function changeEmail(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.string().email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Enter a valid email address." };
  const email = parsed.data;
  if (email === user.email) return { error: "That's already your email." };
  if (email === adminEmail()) return { error: "That email can't be used." };
  if (await db.user.findUnique({ where: { email } })) return { error: "Another account already uses that email." };
  const key = `email-change:${user.id}:${email}`;

  const code = String(form.get("code") ?? "").trim();
  if (!code) {
    if (process.env.NODE_ENV === "production" && !process.env.RESEND_API_KEY) return { error: "Email changes aren't available yet. Please contact us." };
    try {
      const c = await issueCode(key);
      await sendEmail(email, `Your Raleche code: ${c}`, `<p>Enter <b>${c}</b> to confirm your new email address. It expires in 10 minutes.</p>`);
    } catch (e) {
      return { error: (e as Error).message };
    }
    return { step: "code", email };
  }
  if (!(await verifyOtp(key, code))) return { step: "code", email, error: "That code is wrong or expired." };
  await db.user.update({ where: { id: user.id }, data: { email } });
  await syncStripeCustomer(user.stripeCustomerId, { email });
  revalidatePath("/account", "layout");
  return { ok: `Email changed to ${email}.` };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) return { error: "Current password is wrong." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  // Sign out other devices.
  const keep = await currentSessionId();
  await db.session.deleteMany({ where: { userId: user.id, ...(keep ? { NOT: { id: keep } } : {}) } });
  revalidatePath("/account/profile");
  return { ok: user.passwordHash ? "Password changed." : "Password set. You can now sign in with your email and password." };
}
