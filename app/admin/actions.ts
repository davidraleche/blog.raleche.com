"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { slugify, readMinutes } from "@/lib/utils";
import { importFromSource } from "@/lib/importer";
import { sendEmail } from "@/lib/email";
import { renderMarkdown } from "@/lib/markdown";
import { stripe } from "@/lib/stripe";
import { AD_KEYS } from "@/lib/ads";

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
  const post = id
    ? await db.post.update({ where: { id }, data })
    : await db.post.create({ data: { ...data, authorId: admin.id } });
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
  const body = ["This week on Raleche:", "", ...posts.flatMap((p) => [`## [${p.title}](${url}/story/${p.slug})`, p.dek, ""]), `[Become a member](${url}/membership) to unlock the executive summary on every story.`].join("\n");
  const c = await db.campaign.create({ data: { subject: `The Raleche Briefing — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`, body } });
  redirect(`/admin/newsletter/campaigns/${c.id}`);
}

function campaignHtml(body: string, unsubscribeKey?: string) {
  const url = process.env.APP_URL || "http://localhost:3000";
  return `<div style="max-width:600px;margin:auto;font-family:Georgia,serif;font-size:17px;line-height:1.6;color:#111">
<div style="background:#000;color:#fff;padding:16px 20px;font-family:Arial Narrow,Arial,sans-serif;font-weight:800;font-size:28px;letter-spacing:2px">RALECHE</div>
<div style="padding:20px">${renderMarkdown(body)}</div>
<p style="font-family:monospace;font-size:11px;color:#888;padding:0 20px">${unsubscribeKey ? `<a href="${url}/unsubscribe?key=${unsubscribeKey}" style="color:#888">Unsubscribe</a>` : "Test send"}</p></div>`;
}

export async function sendCampaign(form: FormData) {
  const admin = await requireAdmin();
  const c = await db.campaign.findUniqueOrThrow({ where: { id: str(form, "id") } });
  if (form.get("test")) {
    if (admin.email) await sendEmail(admin.email, `[TEST] ${c.subject}`, campaignHtml(c.body));
    redirect(`/admin/newsletter/campaigns/${c.id}?test=1`);
  }
  if (c.status === "sent") redirect(`/admin/newsletter/campaigns/${c.id}`);
  const subs = await db.subscriber.findMany({ where: { status: "subscribed" } });
  let sent = 0;
  for (const s of subs) if (await sendEmail(s.email, c.subject, campaignHtml(c.body, s.unsubscribeKey))) sent++;
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
