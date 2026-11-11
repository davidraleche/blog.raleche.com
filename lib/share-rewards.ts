import "server-only";
import crypto from "node:crypto";
import { db } from "./db";
import { credit, SHARE_REWARD, SHARE_DAILY_CAP } from "./tokens";
import { sendEmail } from "./email";
import { logActivity } from "./activity";
import { messages, isLocale, fmt } from "./i18n/messages";

/** The reader's public share code (?by=…), created the first time they need one. */
export async function shareCodeFor(userId: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { shareCode: true } });
  if (u?.shareCode) return u.shareCode;
  for (let i = 0; i < 5; i++) {
    const code = crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "").slice(0, 7).toLowerCase();
    if (code.length < 6 || (await db.user.findFirst({ where: { shareCode: code }, select: { id: true } }))) continue;
    await db.user.update({ where: { id: userId }, data: { shareCode: code } });
    return code;
  }
  throw new Error("could not create a share code");
}

/** The member behind a ?by= code, or null. */
export async function sharerByCode(code: string | null | undefined) {
  const c = (code ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]{4,12}$/.test(c)) return null;
  return db.user.findFirst({ where: { shareCode: c }, select: { id: true, email: true, name: true, language: true } });
}

const NETWORK: Record<string, string> = { twitter: "X", linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };

/**
 * A new visitor opened a page from a member's share link: give the member SHARE_REWARD tokens, record it
 * (shown in their token history) and email them. Not paid for their own visits, a returning visitor, the same
 * connection twice, or past SHARE_DAILY_CAP rewards in 24 hours.
 */
export async function rewardShare(opts: {
  sharer: { id: string; email: string | null; name: string | null; language: string | null };
  visitorId: string; viewerUserId: string | null; ip: string | null; path: string; title: string; source: string | null;
}) {
  const { sharer, visitorId, viewerUserId, ip, path, source } = opts;
  if (viewerUserId === sharer.id) return false;
  // A visitor who has been here before (other than this first page view) is not new.
  if ((await db.pageView.count({ where: { visitorId } })) > 1) return false;
  // The sharer's own browsers never count.
  if (await db.pageView.findFirst({ where: { visitorId, userId: sharer.id }, select: { id: true } })) return false;
  const day = new Date(Date.now() - 86400e3);
  if ((await db.tokenTxn.count({ where: { userId: sharer.id, reason: "share", createdAt: { gte: day } } })) >= SHARE_DAILY_CAP) return false;

  const title = opts.title.replace(/ \| RALECHE$/, "").slice(0, 140) || path;
  const network = source ? NETWORK[source] ?? source : "";
  const note = `${title}${network ? ` · ${network}` : ""}`;
  // One reward per visitor and per internet connection (a cleared browser on the same connection doesn't pay twice).
  const ipRef = ip ? crypto.createHash("sha256").update(`${sharer.id}:${ip}`).digest("base64url").slice(0, 22) : null;
  if (ipRef && (await db.tokenTxn.findUnique({ where: { ref: `share-ip:${ipRef}` }, select: { id: true } }))) return false;
  const ok = await credit(sharer.id, SHARE_REWARD, "share", `share:${sharer.id}:${visitorId}`, note);
  if (!ok) return false;
  // A zero-amount marker keeps the connection from paying again (it doesn't show in the reader's history).
  if (ipRef) await db.tokenTxn.create({ data: { userId: sharer.id, amount: 0, reason: "share_ip", ref: `share-ip:${ipRef}` } }).catch(() => {});

  const balance = (await db.user.findUnique({ where: { id: sharer.id }, select: { tokenBalance: true } }))?.tokenBalance ?? 0;
  await logActivity({ kind: "share_reward", userId: sharer.id, detail: `+${SHARE_REWARD} tokens to ${sharer.name || sharer.email || sharer.id}: a new reader opened ${path}${network ? ` from ${network}` : ""}` }).catch(() => {});
  if (sharer.email) {
    const m = messages[isLocale(sharer.language) ? sharer.language : "en"];
    const vars = { n: SHARE_REWARD, title, network: network || "share", balance };
    const url = "https://raleche.com/account/invoices";
    const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#111">
<p>${fmt(m.shareRewardEmailBody, { ...vars, title: title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") })}</p>
<p><a href="${url}" style="color:#d6261c">${fmt(m.shareRewardEmailLink, vars)}</a></p>
<p style="color:#666;font-size:13px">${fmt(m.shareRewardEmailFoot, { cap: SHARE_DAILY_CAP, n: SHARE_REWARD })}</p></div>`;
    await sendEmail(sharer.email, fmt(m.shareRewardEmailSubject, vars), html).catch(() => {});
  }
  return true;
}
