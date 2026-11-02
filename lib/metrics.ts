import "server-only";
import { db } from "./db";

const DAY = 864e5;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const range = (n: number) => Array.from({ length: n }, (_, i) => dayKey(new Date(Date.now() - (n - 1 - i) * DAY)));

export async function dashboardMetrics() {
  const since90 = new Date(Date.now() - 90 * DAY);
  const [subs, users, subscribers, views, posts, plans, campaigns] = await Promise.all([
    db.subscription.findMany({ include: { user: { select: { email: true, phone: true, name: true, role: true } }, plan: true }, orderBy: { createdAt: "desc" } }),
    db.user.findMany({ select: { id: true, createdAt: true, email: true, phone: true, name: true }, orderBy: { createdAt: "desc" } }),
    db.subscriber.findMany({ select: { createdAt: true, status: true, email: true }, orderBy: { createdAt: "desc" } }),
    db.postView.findMany({ where: { day: { gte: dayKey(since90) } } }),
    db.post.findMany({ select: { id: true, title: true, slug: true, views: true, status: true, publishedAt: true, category: { select: { name: true } } } }),
    db.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    db.campaign.count({ where: { status: "sent" } }),
  ]);

  const paying = subs.filter((s) => ["active", "trialing", "past_due"].includes(s.status));
  const mrr = paying.reduce((a, s) => a + s.priceCents, 0);

  const days90 = range(90);
  const mrrSeries = days90.map((day) => {
    const end = new Date(day + "T23:59:59Z");
    const v = subs.filter((s) => s.createdAt <= end && (s.status !== "canceled" || s.updatedAt > end)).reduce((a, s) => a + s.priceCents, 0);
    return { day, value: v / 100 };
  });

  const days30 = range(30);
  const countBy = <T,>(rows: T[], get: (r: T) => string) => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(get(r), (m.get(get(r)) ?? 0) + 1));
    return m;
  };
  const signupMap = countBy(users, (u) => dayKey(u.createdAt));
  const subMap = countBy(subscribers, (s) => dayKey(s.createdAt));
  const viewMap = new Map<string, number>();
  views.forEach((v) => viewMap.set(v.day, (viewMap.get(v.day) ?? 0) + v.count));
  const daily = days30.map((day) => ({ day, signups: signupMap.get(day) ?? 0, subscribers: subMap.get(day) ?? 0, views: viewMap.get(day) ?? 0 }));

  const sumWindow = (key: "signups" | "subscribers" | "views", from: number, to: number) => daily.slice(from, to).reduce((a, d) => a + d[key], 0);
  const delta = (key: "signups" | "subscribers" | "views") => {
    const cur = sumWindow(key, 23, 30), prev = sumWindow(key, 16, 23);
    return { cur, prev, pct: prev ? ((cur - prev) / prev) * 100 : cur ? 100 : 0 };
  };
  const mrr30 = mrrSeries[mrrSeries.length - 31]?.value ?? 0;

  const views30ByPost = new Map<string, number>();
  views.filter((v) => v.day >= days30[0]).forEach((v) => views30ByPost.set(v.postId, (views30ByPost.get(v.postId) ?? 0) + v.count));
  const topPosts = posts
    .map((p) => ({ ...p, views30: views30ByPost.get(p.id) ?? 0 }))
    .sort((a, b) => b.views30 - a.views30 || b.views - a.views)
    .slice(0, 8);

  const planMix = plans.map((p) => ({ name: p.name, count: paying.filter((s) => s.planId === p.id).length, mrr: paying.filter((s) => s.planId === p.id).reduce((a, s) => a + s.priceCents, 0) / 100 }));

  const activity = [
    ...users.slice(0, 15).map((u) => ({ at: u.createdAt, kind: "SIGNUP", text: u.email || u.phone || u.name || "user" })),
    ...subs.slice(0, 15).map((s) => ({ at: s.createdAt, kind: s.status === "canceled" ? "CHURN" : "SUB", text: `${s.user.email || s.user.phone} · ${s.plan.name} $${s.priceCents / 100}` })),
    ...subscribers.slice(0, 15).map((s) => ({ at: s.createdAt, kind: "NEWS", text: s.email })),
  ].sort((a, b) => +b.at - +a.at).slice(0, 18);

  const activeSubscribers = subscribers.filter((s) => s.status === "subscribed").length;
  return {
    mrr: mrr / 100,
    mrrChangePct: mrr30 ? ((mrr / 100 - mrr30) / mrr30) * 100 : mrr ? 100 : 0,
    arr: (mrr * 12) / 100,
    members: paying.length,
    churned: subs.filter((s) => s.status === "canceled").length,
    users: users.length,
    conversion: users.length ? (paying.length / users.length) * 100 : 0,
    arpu: paying.length ? mrr / 100 / paying.length : 0,
    subscribers: activeSubscribers,
    publishedPosts: posts.filter((p) => p.status === "published").length,
    draftPosts: posts.filter((p) => p.status !== "published").length,
    totalViews: posts.reduce((a, p) => a + p.views, 0),
    campaigns,
    signups: delta("signups"),
    newsletter: delta("subscribers"),
    views: delta("views"),
    mrrSeries,
    daily,
    topPosts,
    planMix,
    activity,
  };
}
export type Metrics = Awaited<ReturnType<typeof dashboardMetrics>>;
