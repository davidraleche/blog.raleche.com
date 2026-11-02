"use server";
import { z } from "zod";
import { db } from "@/lib/db";

export async function subscribeNewsletter(_: unknown, form: FormData) {
  const email = z.string().email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter a valid email." };
  await db.subscriber.upsert({
    where: { email: email.data },
    create: { email: email.data, source: String(form.get("source") ?? "site") },
    update: { status: "subscribed" },
  });
  return { ok: true, message: "You're on the list. Watch your inbox." };
}
