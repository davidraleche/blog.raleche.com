import "server-only";
import crypto from "node:crypto";
import { db } from "./db";

/**
 * Comment safety: what a comment must pass before it's saved, and whether it goes public right away
 * or waits for an admin. Layers, cheapest first:
 *  - bot traps: a hidden honeypot field and a signed "form shown at" time (instant submits are bots)
 *  - cleanup: Unicode normalisation, control/zero-width characters stripped, length limits
 *  - no links, emails or phone numbers (the usual spam payload)
 *  - rate limits per minute, hour, day and per story; duplicate text refused
 *  - review queue for new or unverified accounts, copy-paste text seen from other accounts, and spammy text
 *  - banned accounts can't comment; readers can report, and 3 reports hide a comment for review
 */

export const MAX_COMMENT = 1000;
const MIN_FILL_MS = 3000; // a person can't read, type and send in under 3 seconds
const secret = () => process.env.SESSION_SECRET || "dev-secret";

/** Signed timestamp put in the form when it's rendered. */
export function formStamp(now = Date.now()) {
  const sig = crypto.createHmac("sha256", secret()).update(`comment:${now}`).digest("base64url").slice(0, 16);
  return `${now}.${sig}`;
}
function stampAge(stamp: string) {
  const [t, sig] = stamp.split(".");
  const ts = Number(t);
  if (!ts || sig !== crypto.createHmac("sha256", secret()).update(`comment:${ts}`).digest("base64url").slice(0, 16)) return null;
  return Date.now() - ts;
}

export function cleanComment(raw: string) {
  return raw
    .normalize("NFKC")
    .replace(/[​-‏‪-‮⁠-⁤﻿]/g, "") // zero-width and direction-override characters
    .replace(/[^\S\n]+/g, " ") // collapse spaces and tabs, keep line breaks
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "") // control characters
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ai|co|xyz|ru|cn|info|biz|top|site|online|app|dev|me|ly|gg|tk)\b|\[[^\]]*\]\([^)]*\)|<a\s)/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE = /(\+?\d[\s().-]?){9,}/;
const SPAMMY = /\b(crypto|bitcoin|forex|casino|viagra|cialis|loan|onlyfans|telegram|whatsapp|dm me|click here|free money|investment opportunity|seo services)\b/i;

function looksSpammy(text: string) {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length > 20 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.7) return "mostly capitals";
  if (/(.)\1{7,}/.test(text)) return "repeated characters";
  if ((text.match(/\p{Extended_Pictographic}/gu) ?? []).length > 10) return "many emojis";
  if (SPAMMY.test(text)) return "spam keywords";
  return null;
}

export type GuardResult =
  | { ok: true; body: string; hold: string | null }
  | { ok: false; error: "tooShort" | "tooLong" | "links" | "slowDown" | "limit" | "duplicate" | "blocked"; silent?: boolean };

export async function checkComment(input: {
  user: { id: string; createdAt: Date; googleId: string | null; phone: string | null; role: string; commentBanned: boolean };
  postId: string; raw: string; honeypot: string; stamp: string;
}): Promise<GuardResult> {
  const { user, postId } = input;
  if (user.commentBanned) return { ok: false, error: "blocked" };

  // Bot traps. Answer bots as if the comment went through (silent), so they learn nothing.
  if (input.honeypot.trim()) return { ok: false, error: "slowDown", silent: true };
  const age = stampAge(input.stamp);
  if (age === null || age < MIN_FILL_MS || age > 24 * 3600e3) return { ok: false, error: "slowDown", silent: age !== null && age < MIN_FILL_MS };

  const body = cleanComment(input.raw);
  if (body.replace(/\s/g, "").length < 2) return { ok: false, error: "tooShort" };
  if (body.length > MAX_COMMENT) return { ok: false, error: "tooLong" };
  if (LINK.test(body) || EMAIL.test(body) || PHONE.test(body)) return { ok: false, error: "links" };

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin) {
    const since = (ms: number) => new Date(Date.now() - ms);
    const [lastMinute, lastHour, lastDay, onStory, sameText] = await Promise.all([
      db.comment.count({ where: { userId: user.id, createdAt: { gt: since(60e3) } } }),
      db.comment.count({ where: { userId: user.id, createdAt: { gt: since(3600e3) } } }),
      db.comment.count({ where: { userId: user.id, createdAt: { gt: since(86400e3) } } }),
      db.comment.count({ where: { userId: user.id, postId, createdAt: { gt: since(3600e3) } } }),
      db.comment.findFirst({ where: { userId: user.id, body, createdAt: { gt: since(7 * 86400e3) } }, select: { id: true } }),
    ]);
    if (sameText) return { ok: false, error: "duplicate" };
    if (lastMinute >= 2 || onStory >= 3) return { ok: false, error: "slowDown" };
    if (lastHour >= 10 || lastDay >= 30) return { ok: false, error: "limit" };
  }

  // Goes public right away, or waits for review?
  let hold: string | null = null;
  if (!isAdmin) {
    const verified = !!user.googleId || !!user.phone;
    const accountAgeH = (Date.now() - user.createdAt.getTime()) / 3600e3;
    const hasPublic = await db.comment.findFirst({ where: { userId: user.id, hidden: false }, select: { id: true } });
    const copied = body.length >= 20 && (await db.comment.findFirst({ where: { body, userId: { not: user.id }, createdAt: { gt: new Date(Date.now() - 86400e3) } }, select: { id: true } }));
    hold =
      looksSpammy(body) ??
      (copied ? "same text as another account" : null) ??
      (!hasPublic && !verified ? "first comment from an unverified account" : null) ??
      (!hasPublic && accountAgeH < 24 ? "first comment from a new account" : null);
  }
  return { ok: true, body, hold };
}
