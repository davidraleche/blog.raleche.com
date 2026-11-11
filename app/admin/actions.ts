"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { slugify, readMinutes } from "@/lib/utils";
import { importFromSource } from "@/lib/importer";
import { sendEmail } from "@/lib/email";
import { renderMarkdown } from "@/lib/markdown";
import { stripe } from "@/lib/stripe";
import { AD_KEYS } from "@/lib/ads";
import { translateHtml, translateMany } from "@/lib/translate";
import { messages, isLocale, type Locale } from "@/lib/i18n/messages";
import { credit, PARTICIPATION_REWARD } from "@/lib/tokens";
import { generateQuiz, isValidQuiz } from "@/lib/quiz";
import { prepareStories } from "@/lib/prepare";
import { saveMentions, isValidMentions } from "@/lib/books";
import { extractMentions, fetchTranscript } from "@/lib/mentions-ai";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/* ---------- Posts ---------- */
export async function savePost(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const title = str(form, "title");
  if (!title) throw new Error("Title is required");
  const body = str(form, "body");
  const status = str(form, "status") || "draft";
  const publishedAtRaw = str(form, "publishedAt");
  const data = {
    title,
    slug: slugify(str(form, "slug") || title),
    dek: str(form, "dek"),
    body,
    executiveSummary: str(form, "executiveSummary"),
    coverImage: str(form, "coverImage") || null,
    tags: str(form, "tags"),
    speaker: str(form, "speaker") || null,
    host: str(form, "host") || null,
    show: str(form, "show") || null,
    status,
    featured: form.get("featured") === "on",
    premium: form.get("premium") === "on",
    categoryId: str(form, "categoryId") || null,
    authorName: str(form, "authorName") || admin.name || "Raleche Staff",
    readMinutes: readMinutes(body),
    publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : status === "published" ? new Date() : null,
  };
  if (data.featured) await db.post.updateMany({ where: { featured: true, NOT: { id } }, data: { featured: false } });
  // A summary edited by hand is kept: marking it written stops the automatic rewrite from replacing it.
  const before = id ? await db.post.findUnique({ where: { id }, select: { executiveSummary: true } }) : null;
  const summaryEdited = !!data.executiveSummary && (!before || before.executiveSummary !== data.executiveSummary);
  const post = id
    ? await db.post.update({ where: { id }, data: summaryEdited ? { ...data, summaryAt: new Date() } : data })
    : await db.post.create({ data: { ...data, authorId: admin.id, summaryAt: summaryEdited ? new Date() : null } });
  // Publishing gets the story ready: books and people for the Books section, quiz, translations.
  if (post.status === "published") after(() => prepareStories([post.id]));
  revalidatePath("/", "layout");
  redirect(`/admin/posts/${post.id}?saved=1`);
}

export async function deletePost(form: FormData) {
  await requireAdmin();
  await db.post.delete({ where: { id: str(form, "id") } });
  revalidatePath("/", "layout");
  redirect("/admin/posts");
}

export async function quickPostUpdate(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const field = str(form, "field");
  if (field === "status") {
    const status = str(form, "value");
    const post = await db.post.findUniqueOrThrow({ where: { id } });
    await db.post.update({ where: { id }, data: { status, publishedAt: status === "published" ? post.publishedAt ?? new Date() : post.publishedAt } });
  } else if (field === "featured") {
    await db.post.updateMany({ where: { featured: true }, data: { featured: false } });
    await db.post.update({ where: { id }, data: { featured: true } });
  }
  revalidatePath("/", "layout");
}

/* ---------- Categories ---------- */
export async function saveCategory(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const name = str(form, "name");
  if (!name) return;
  const data = { name, slug: slugify(str(form, "slug") || name), sortOrder: Number(str(form, "sortOrder")) || 0 };
  if (id) await db.category.update({ where: { id }, data });
  else await db.category.create({ data });
  revalidatePath("/", "layout");
}
export async function deleteCategory(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  await db.post.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  await db.category.delete({ where: { id } });
  revalidatePath("/", "layout");
}

/* ---------- Members ---------- */
export async function setUserRole(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "id");
  if (id === admin.id) return; // never demote yourself
  await db.user.update({ where: { id }, data: { role: str(form, "role") === "ADMIN" ? "ADMIN" : "USER" } });
  revalidatePath("/admin/members");
}
export async function compMembership(form: FormData) {
  await requireAdmin();
  const userId = str(form, "id");
  const planId = str(form, "planId");
  const days = Number(str(form, "days")) || 30;
  await db.subscription.create({ data: { userId, planId, status: "active", priceCents: 0, currentPeriodEnd: new Date(Date.now() + days * 864e5) } });
  revalidatePath("/admin/members");
}
export async function deleteUser(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "id");
  if (id === admin.id) return;
  await db.user.delete({ where: { id } });
  revalidatePath("/admin/members");
}

/* ---------- Subscriptions ---------- */
export async function cancelSubscription(form: FormData) {
  await requireAdmin();
  const sub = await db.subscription.findUniqueOrThrow({ where: { id: str(form, "id") } });
  if (sub.stripeSubscriptionId && stripe) await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  await db.subscription.update({ where: { id: sub.id }, data: { status: "canceled" } });
  revalidatePath("/admin/subscriptions");
}

/* ---------- Plans ---------- */
export async function savePlan(form: FormData) {
  await requireAdmin();
  const dollars = Number(str(form, "price"));
  await db.plan.update({
    where: { id: str(form, "id") },
    data: {
      name: str(form, "name"),
      tagline: str(form, "tagline"),
      features: str(form, "features"),
      priceCents: Math.round(dollars * 100),
      active: form.get("active") === "on",
    },
  });
  revalidatePath("/", "layout");
}

/* ---------- Newsletter ---------- */
export async function addSubscriber(form: FormData) {
  await requireAdmin();
  const email = str(form, "email").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return;
  await db.subscriber.upsert({ where: { email }, create: { email, source: "admin" }, update: { status: "subscribed" } });
  revalidatePath("/admin/newsletter");
}
export async function toggleSubscriber(form: FormData) {
  await requireAdmin();
  const s = await db.subscriber.findUniqueOrThrow({ where: { id: str(form, "id") } });
  await db.subscriber.update({ where: { id: s.id }, data: { status: s.status === "subscribed" ? "unsubscribed" : "subscribed" } });
  revalidatePath("/admin/newsletter");
}
export async function deleteSubscriber(form: FormData) {
  await requireAdmin();
  await db.subscriber.delete({ where: { id: str(form, "id") } });
  revalidatePath("/admin/newsletter");
}

export async function saveCampaign(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const data = { subject: str(form, "subject"), body: str(form, "body") };
  const c = id ? await db.campaign.update({ where: { id }, data }) : await db.campaign.create({ data });
  redirect(`/admin/newsletter/campaigns/${c.id}?saved=1`);
}

export async function draftDigest() {
  await requireAdmin();
  const posts = await db.post.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" }, take: 5 });
  const url = process.env.APP_URL || "http://localhost:3000";
  const body = ["This week on Raleche:", "", ...posts.flatMap((p) => [`## [${p.title}](${url}/story/${p.slug})`, p.dek, ""]), `[Get tokens](${url}/store) to unlock executive summaries. Spin the daily wheel and take each story's quiz to earn them free.`].join("\n");
  const c = await db.campaign.create({ data: { subject: `The Raleche Briefing — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`, body } });
  redirect(`/admin/newsletter/campaigns/${c.id}`);
}

function campaignHtml(bodyHtml: string, unsubscribeKey?: string, lang: Locale = "en") {
  const url = process.env.APP_URL || "http://localhost:3000";
  return `<div style="max-width:600px;margin:auto;font-family:Georgia,serif;font-size:17px;line-height:1.6;color:#111">
<div style="background:#000;color:#fff;padding:16px 20px;font-family:Arial Narrow,Arial,sans-serif;font-weight:800;font-size:28px;letter-spacing:2px">RALECHE</div>
<div style="padding:20px">${bodyHtml}</div>
<p style="font-family:monospace;font-size:11px;color:#888;padding:0 20px">${unsubscribeKey ? `<a href="${url}/unsubscribe?key=${unsubscribeKey}" style="color:#888">${messages[lang].unsubscribe}</a>` : "Test send"}</p></div>`;
}

/** Subject and body translated into one language (machine translation, cached). */
async function campaignIn(lang: Locale, subject: string, body: string) {
  const [[s], html] = await Promise.all([translateMany(lang, [subject]), translateHtml(lang, renderMarkdown(body))]);
  return { subject: s, html };
}

export async function sendCampaign(form: FormData) {
  const admin = await requireAdmin();
  const c = await db.campaign.findUniqueOrThrow({ where: { id: str(form, "id") } });
  if (form.get("test")) {
    // Test goes out in the admin's preferred language, so translations can be checked.
    const lang = isLocale(admin.language) ? admin.language : "en";
    const v = await campaignIn(lang, c.subject, c.body);
    if (admin.email) await sendEmail(admin.email, `[TEST] ${v.subject}`, campaignHtml(v.html, undefined, lang));
    redirect(`/admin/newsletter/campaigns/${c.id}?test=1`);
  }
  if (c.status === "sent") redirect(`/admin/newsletter/campaigns/${c.id}`);
  const subs = await db.subscriber.findMany({ where: { status: "subscribed" } });
  let sent = 0;
  const versions = new Map<Locale, { subject: string; html: string }>();
  for (const s of subs) {
    const lang: Locale = isLocale(s.language) ? s.language : "en";
    if (!versions.has(lang)) versions.set(lang, await campaignIn(lang, c.subject, c.body));
    const v = versions.get(lang)!;
    if (await sendEmail(s.email, v.subject, campaignHtml(v.html, s.unsubscribeKey, lang))) sent++;
  }
  await db.campaign.update({ where: { id: c.id }, data: { status: "sent", sentCount: sent, sentAt: new Date() } });
  redirect(`/admin/newsletter/campaigns/${c.id}?sent=${sent}`);
}

export async function deleteCampaign(form: FormData) {
  await requireAdmin();
  await db.campaign.delete({ where: { id: str(form, "id") } });
  redirect("/admin/newsletter");
}

/* ---------- Import & settings ---------- */
export async function runImport() {
  await requireAdmin();
  const r = await importFromSource();
  revalidatePath("/", "layout");
  after(() => prepareStories(r.postIds));
  redirect(`/admin/import?created=${r.created}&updated=${r.updated}&errors=${r.errors.length}`);
}

export async function saveSettings(form: FormData) {
  await requireAdmin();
  for (const key of ["siteName", "tagline", "gaMeasurementId"]) {
    let value = str(form, key);
    if (key === "gaMeasurementId") value = value.toUpperCase();
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}

export async function saveAdSettings(form: FormData) {
  await requireAdmin();
  for (const key of AD_KEYS) {
    let value = str(form, key);
    if (key === "adsenseClient" && /^pub-\d+$/.test(value)) value = `ca-${value}`;
    if (key === "adsHideForMembers") value = value === "on" ? "on" : "off";
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}

/* ---------- Member email lists ---------- */
/** Subscribe or unsubscribe a member from an email list. Silent: no welcome email when an admin does it. */
export async function setMemberList(form: FormData) {
  await requireAdmin();
  const user = await db.user.findUniqueOrThrow({ where: { id: str(form, "id") }, select: { email: true } });
  const on = str(form, "on") === "1";
  if (str(form, "list") === "newsletter" && user.email) {
    await db.subscriber.upsert({
      where: { email: user.email },
      create: { email: user.email, source: "admin", status: on ? "subscribed" : "unsubscribed" },
      update: { status: on ? "subscribed" : "unsubscribed" },
    });
  }
  revalidatePath("/admin/members");
  revalidatePath("/admin/newsletter");
}

/* ---------- Tokens, language, comments ---------- */
export async function adjustTokens(form: FormData) {
  const admin = await requireAdmin();
  const amount = Math.trunc(Number(str(form, "amount")));
  if (!amount) return;
  await credit(str(form, "id"), amount, "admin", undefined, str(form, "note") || `by ${admin.email ?? admin.id}`);
  revalidatePath("/admin/members");
}

export async function setMemberLanguage(form: FormData) {
  await requireAdmin();
  const language = str(form, "language");
  if (!isLocale(language)) return;
  const user = await db.user.update({ where: { id: str(form, "id") }, data: { language }, select: { email: true } });
  if (user.email) await db.subscriber.updateMany({ where: { email: user.email }, data: { language } });
  revalidatePath("/admin/members");
}

export async function moderateComment(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const op = str(form, "op");
  if (op === "delete") await db.comment.delete({ where: { id } });
  else if (op === "hide") await db.comment.update({ where: { id }, data: { hidden: true, heldReason: "hidden by admin" } });
  else {
    // Approve: make it public and pay the comment reward if it hasn't been paid.
    const c = await db.comment.update({ where: { id }, data: { hidden: false, heldReason: null } });
    if (!c.rewarded) {
      await credit(c.userId, PARTICIPATION_REWARD, "comment", `comment:${c.userId}:${c.postId}`);
      await db.comment.update({ where: { id }, data: { rewarded: true } });
    }
  }
  revalidatePath("/admin/comments");
}

/* ---------- Quizzes ---------- */
export async function saveQuiz(form: FormData) {
  await requireAdmin();
  const postId = str(form, "postId");
  let questions: unknown;
  try { questions = JSON.parse(str(form, "json")); } catch { redirect(`/admin/quizzes?error=json&post=${postId}`); }
  if (!isValidQuiz(questions)) redirect(`/admin/quizzes?error=shape&post=${postId}`);
  await db.quiz.upsert({ where: { postId }, create: { postId, questions: questions as object, source: "admin" }, update: { questions: questions as object, source: "admin" } });
  revalidatePath("/admin/quizzes");
  redirect(`/admin/quizzes?saved=${postId}`);
}

export async function regenerateQuiz(form: FormData) {
  await requireAdmin();
  const post = await db.post.findUniqueOrThrow({ where: { id: str(form, "postId") }, select: { id: true, title: true, body: true, executiveSummary: true } });
  let questions;
  try {
    questions = await generateQuiz(post.title, post.executiveSummary || post.body);
  } catch (e) {
    redirect(`/admin/quizzes?error=${encodeURIComponent((e as Error).message.slice(0, 120))}&post=${post.id}`);
  }
  await db.quiz.upsert({ where: { postId: post.id }, create: { postId: post.id, questions, source: "ai" }, update: { questions, source: "ai" } });
  revalidatePath("/admin/quizzes");
  redirect(`/admin/quizzes?saved=${post.id}`);
}

/** Checks every published story: quiz exists, every answer is in the executive summary, translations are ready. Runs in the background. */
export async function prepareAllStories() {
  await requireAdmin();
  const posts = await db.post.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" }, select: { id: true } });
  after(() => prepareStories(posts.map((p) => p.id), { recheck: true }));
  redirect(`/admin/quizzes?preparing=${posts.length}`);
}

/* ---------- Books ---------- */
export async function saveAmazonTag(form: FormData) {
  await requireAdmin();
  const value = str(form, "tag");
  await db.setting.upsert({ where: { key: "amazonTag" }, create: { key: "amazonTag", value }, update: { value } });
  revalidatePath("/admin/books");
  revalidatePath("/books");
}

export async function saveBook(form: FormData) {
  await requireAdmin();
  const asin = str(form, "asin").toUpperCase() || null;
  const coverUrl = str(form, "coverUrl") || null;
  if (asin && !/^[A-Z0-9]{10}$/.test(asin)) redirect(`/admin/books?error=asin`);
  if (coverUrl && !/^https:\/\//.test(coverUrl)) redirect(`/admin/books?error=cover`);
  await db.book.update({ where: { id: str(form, "id") }, data: { asin, coverUrl } });
  revalidatePath("/admin/books");
  revalidatePath("/books");
}

export async function saveArticleMentions(form: FormData) {
  await requireAdmin();
  const postId = str(form, "postId");
  let m: unknown;
  try { m = JSON.parse(str(form, "json")); } catch { redirect(`/admin/books?error=json&post=${postId}`); }
  if (!isValidMentions(m)) redirect(`/admin/books?error=shape&post=${postId}`);
  await saveMentions(postId, m);
  revalidatePath("/admin/books");
  redirect(`/admin/books?saved=${postId}#articles`);
}

export async function reextractMentions(form: FormData) {
  await requireAdmin();
  const post = await db.post.findUniqueOrThrow({ where: { id: str(form, "postId") }, select: { id: true, slug: true, title: true, body: true } });
  let m;
  try {
    m = await extractMentions(post.title, post.body, await fetchTranscript(post.slug));
  } catch (e) {
    redirect(`/admin/books?error=${encodeURIComponent((e as Error).message.slice(0, 120))}&post=${post.id}#articles`);
  }
  await saveMentions(post.id, m);
  revalidatePath("/admin/books");
  redirect(`/admin/books?saved=${post.id}#articles`);
}

export async function setCommentBan(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "userId");
  if (id === admin.id) return;
  const banned = str(form, "banned") === "1";
  await db.user.update({ where: { id }, data: { commentBanned: banned } });
  // Banning also takes their comments down.
  if (banned) await db.comment.updateMany({ where: { userId: id, hidden: false }, data: { hidden: true, heldReason: "commenter banned" } });
  revalidatePath("/admin/comments");
}

/* ---------- Activity alerts ---------- */
export async function setAdminAlerts(form: FormData) {
  await requireAdmin();
  const value = str(form, "value") === "off" ? "off" : "on";
  await db.setting.upsert({ where: { key: "adminAlerts" }, create: { key: "adminAlerts", value }, update: { value } });
  revalidatePath("/admin/activity");
}
