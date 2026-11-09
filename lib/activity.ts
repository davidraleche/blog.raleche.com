import "server-only";
import { db } from "./db";
import { sendEmail } from "./email";
import { adminEmail } from "./auth";

export type ActivityKind = "comment" | "vote" | "spin" | "quiz" | "purchase" | "unlock" | "follow";

/** Kinds that also send the admin an email (the rest are only logged). */
const EMAILED: ActivityKind[] = ["comment", "vote", "spin", "quiz", "purchase"];
/** Resend's free plan allows 100 emails a day for everything, so admin alerts are capped. */
const DAILY_EMAIL_CAP = Number(process.env.ADMIN_ALERT_CAP ?? 40);

const LABEL: Record<ActivityKind, string> = {
  comment: "New comment", vote: "New vote", spin: "Wheel spin", quiz: "Quiz played", purchase: "Token purchase", unlock: "Summary unlocked", follow: "New follow",
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Record what a reader did and, for the main actions, email the admin who did it.
 * Never throws: tracking must not break the reader's action.
 */
export async function logActivity(a: { kind: ActivityKind; userId?: string | null; postId?: string | null; detail: string }) {
  try {
    const row = await db.activity.create({ data: { kind: a.kind, userId: a.userId ?? null, postId: a.postId ?? null, detail: a.detail.slice(0, 500) } });
    if (!EMAILED.includes(a.kind)) return;
    const settings = await db.setting.findUnique({ where: { key: "adminAlerts" } });
    if (settings?.value === "off") return;

    const [user, post] = await Promise.all([
      a.userId ? db.user.findUnique({ where: { id: a.userId }, select: { email: true, phone: true, name: true, role: true } }) : null,
      a.postId ? db.post.findUnique({ where: { id: a.postId }, select: { title: true, slug: true } }) : null,
    ]);
    if (user?.role === "ADMIN") return; // don't email the admin about their own clicks

    const startOfDay = new Date(new Date().toISOString().slice(0, 10));
    const sentToday = await db.activity.count({ where: { emailed: true, createdAt: { gte: startOfDay } } });
    if (sentToday >= DAILY_EMAIL_CAP) return; // still in the dashboard, just no email

    const url = (process.env.APP_URL || "https://raleche.com").replace(/\/$/, "");
    const who = user ? `${user.name ? `${user.name} · ` : ""}${user.email ?? user.phone ?? "member"}` : "Anonymous visitor";
    const capNote = sentToday + 1 === DAILY_EMAIL_CAP ? `<p style="color:#b45309">This is the last alert email today (limit ${DAILY_EMAIL_CAP}). The rest are in the dashboard.</p>` : "";
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p style="font-family:monospace;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#e1251b">${LABEL[a.kind]}</p>
<p><b>Who:</b> ${esc(who)}</p>
${post ? `<p><b>Story:</b> <a href="${url}/story/${post.slug}">${esc(post.title)}</a></p>` : ""}
<p><b>What:</b> ${esc(a.detail)}</p>
<p><a href="${url}/admin/activity">Open the activity dashboard</a></p>${capNote}</div>`;
    if (await sendEmail(adminEmail(), `[RALECHE] ${LABEL[a.kind]}: ${who}`, html)) await db.activity.update({ where: { id: row.id }, data: { emailed: true } });
  } catch (e) {
    console.error(`[activity] ${a.kind} not recorded: ${(e as Error).message}`);
  }
}
