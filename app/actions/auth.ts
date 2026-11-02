"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword, upsertUser, safeNext } from "@/lib/auth";
import { normalizePhone, sendOtp, verifyOtp } from "@/lib/sms";

export type AuthState = { error?: string; step?: "code"; phone?: string; devHint?: string } | null;

/** One form for both sign in and sign up: unknown email = new account. */
export async function emailAuth(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(8, "Password must be at least 8 characters") })
    .safeParse({ email: String(form.get("email") ?? "").trim().toLowerCase(), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  let userId: string;
  if (existing) {
    if (!existing.passwordHash) return { error: "This account uses Google or phone sign-in. Use that option above." };
    if (!(await verifyPassword(password, existing.passwordHash))) return { error: "Wrong password for this email." };
    userId = existing.id;
    await db.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  } else {
    const user = await upsertUser({ email }, { passwordHash: await hashPassword(password), name: String(form.get("name") ?? "") || undefined });
    userId = user.id;
    if (form.get("newsletter") === "on") await db.subscriber.upsert({ where: { email }, create: { email, source: "signup" }, update: { status: "subscribed" } });
  }
  await createSession(userId);
  redirect(safeNext(String(form.get("next") ?? "")));
}

export async function phoneAuth(_: AuthState, form: FormData): Promise<AuthState> {
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  if (!phone) return { error: "Enter a valid phone number, e.g. +1 555 123 4567" };
  const code = String(form.get("code") ?? "").trim();

  if (!code) {
    try {
      const r = await sendOtp(phone);
      return { step: "code", phone, devHint: r.dev ? "Dev mode: no SMS provider set, the code is in the server log." : undefined };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  if (!(await verifyOtp(phone, code))) return { step: "code", phone, error: "That code is wrong or expired." };
  const user = await upsertUser({ phone });
  await createSession(user.id);
  redirect(safeNext(String(form.get("next") ?? "")));
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
