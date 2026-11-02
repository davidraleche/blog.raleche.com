import "server-only";
import crypto from "crypto";
import { db } from "./db";

export function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.length >= 9 ? digits : null;
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

const hash = (s: string) => crypto.createHash("sha256").update(s + (process.env.SESSION_SECRET ?? "")).digest("hex");

export async function sendOtp(phone: string) {
  const recent = await db.otpCode.count({ where: { phone, createdAt: { gt: new Date(Date.now() - 10 * 60e3) } } });
  if (recent >= 5) throw new Error("Too many codes requested. Try again in a few minutes.");
  const code = String(crypto.randomInt(100000, 1000000));
  await db.otpCode.create({ data: { phone, codeHash: hash(code), expiresAt: new Date(Date.now() + 10 * 60e3) } });

  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from } = process.env;
  if (!sid || !token || !from) {
    console.log(`[sms:dev] code for ${phone}: ${code}`);
    return { dev: true };
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: phone, From: from, Body: `Your Raleche code is ${code}` }),
  });
  if (!res.ok) throw new Error("Could not send the SMS. Check the number and try again.");
  return { dev: false };
}

export async function verifyOtp(phone: string, code: string) {
  const otp = await db.otpCode.findFirst({ where: { phone, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.attempts >= 5) return false;
  if (otp.codeHash !== hash(code.trim())) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await db.otpCode.deleteMany({ where: { phone } });
  return true;
}
