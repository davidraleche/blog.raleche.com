import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

// Firebase Hosting only forwards a cookie named __session to Cloud Run, so the session must use that name.
const COOKIE = "__session";
const SESSION_DAYS = 60;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export const adminEmail = () => (process.env.ADMIN_EMAIL || "davidr@tech-team-strategy.com").toLowerCase();

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 11);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

// The cookie holds "<session token>~<language>"; either part may be empty.
async function readCookie() {
  const [token = "", lang = ""] = ((await cookies()).get(COOKIE)?.value ?? "").split("~");
  return { token: token || null, lang: lang || null };
}

async function writeCookie(token: string | null, lang: string | null, expires: Date) {
  const jar = await cookies();
  if (!token && !lang) return jar.delete(COOKIE);
  jar.set(COOKIE, `${token ?? ""}${lang ? `~${lang}` : ""}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.session.create({ data: { id: sha256(token), userId, expiresAt } });
  await writeCookie(token, (await readCookie()).lang, expiresAt);
}

export async function destroySession() {
  const { token, lang } = await readCookie();
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  await writeCookie(null, lang, new Date(Date.now() + 365 * 864e5));
}

export async function currentSessionId() {
  const { token } = await readCookie();
  return token ? sha256(token) : null;
}

export async function getLangCookie() {
  return (await readCookie()).lang;
}

export async function setLangCookie(lang: string) {
  const { token } = await readCookie();
  const session = token ? await db.session.findUnique({ where: { id: sha256(token) }, select: { expiresAt: true } }) : null;
  await writeCookie(session ? token : null, lang, session?.expiresAt ?? new Date(Date.now() + 365 * 864e5));
}

export async function getUser() {
  const { token } = await readCookie();
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}
export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export function activePlan(user: CurrentUser | null) {
  if (!user) return null;
  if (user.role === "ADMIN") return "executive";
  const sub = user.subscriptions.find((s) => ["active", "trialing"].includes(s.status));
  return sub?.planId ?? null;
}

export const canReadSummaries = (user: CurrentUser | null) => activePlan(user) !== null;

export async function requireUser(next = "/account") {
  const user = await getUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user) redirect("/signin?next=/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** Find or create a user. Only a verified email (Google) can be promoted to admin. */
export async function upsertUser(
  where: { email?: string; phone?: string; googleId?: string },
  data: { name?: string; image?: string; passwordHash?: string } = {},
  emailVerified = false,
) {
  const email = where.email?.toLowerCase();
  let user =
    (where.googleId && (await db.user.findUnique({ where: { googleId: where.googleId } }))) ||
    (email && (await db.user.findUnique({ where: { email } }))) ||
    (where.phone && (await db.user.findUnique({ where: { phone: where.phone } }))) ||
    null;
  const role = emailVerified && email === adminEmail() ? "ADMIN" : undefined;
  if (user) {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        googleId: user.googleId ?? where.googleId,
        email: user.email ?? email,
        name: user.name ?? data.name,
        image: user.image ?? data.image,
        ...(role ? { role } : {}),
        lastSeenAt: new Date(),
      },
    });
  } else {
    user = await db.user.create({
      data: { email, phone: where.phone, googleId: where.googleId, ...data, role: role ?? "USER", lastSeenAt: new Date() },
    });
  }
  return user;
}

export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
