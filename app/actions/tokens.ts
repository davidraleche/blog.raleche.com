"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser, requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getI18n, getLocale } from "@/lib/i18n/server";
import { today } from "@/lib/utils";
import { credit, drawPrize, findPack, unlockWithTokens, PARTICIPATION_REWARD, POLL_CHOICES, QUIZ_REWARD } from "@/lib/tokens";
import { getQuiz } from "@/lib/quiz";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";
const SPIN_COOKIE = "wheel_spin";

/* ---------- Store ---------- */
export async function buyTokens(form: FormData) {
  const pack = findPack(String(form.get("pack")));
  if (!pack) redirect("/store");
  const user = await requireUser("/store");

  if (!stripe) {
    // Local demo mode: no Stripe keys, credit immediately.
    if (process.env.NODE_ENV === "production") throw new Error("Stripe is not configured");
    await credit(user.id, pack.tokens, "purchase", undefined, `${pack.tokens} tokens (demo)`);
    redirect(`/store?added=${pack.tokens}`);
  }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const c = await stripe.customers.create({ email: user.email ?? undefined, phone: user.phone ?? undefined, name: user.name ?? undefined, metadata: { userId: user.id } });
    customerId = c.id;
    await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }
  const metadata = { kind: "tokens", userId: user.id, tokens: String(pack.tokens), pack: pack.id };
  const session = await stripe.checkout.sessions.create({
    locale: await getLocale(),
    mode: "payment",
    customer: customerId,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: pack.cents, product_data: { name: `Raleche ${pack.tokens} tokens` } } }],
    metadata,
    payment_intent_data: { metadata },
    invoice_creation: { enabled: true }, // so the purchase shows on the account's Invoices page
    success_url: `${appUrl()}/store?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/store`,
  });
  redirect(session.url!);
}

/* ---------- Executive summaries ---------- */
export async function unlockSummary(form: FormData) {
  const postId = String(form.get("postId"));
  const back = String(form.get("back") || "/");
  const user = await requireUser(back);
  const result = await unlockWithTokens(user.id, postId);
  if (result === "insufficient") redirect(`/store?need=1&next=${encodeURIComponent(back)}`);
  revalidatePath(back);
  redirect(back);
}

/* ---------- Daily wheel ---------- */
export type SpinResult = { prize: number; credited: boolean; balance?: number; already?: boolean };

export async function spinWheel(): Promise<SpinResult> {
  const user = await getUser();
  const day = today();
  if (user) {
    const done = await db.wheelSpin.findUnique({ where: { userId_day: { userId: user.id, day } } });
    if (done) return { prize: done.prize, credited: true, already: true, balance: user.tokenBalance };
    const prize = drawPrize();
    try {
      const spin = await db.wheelSpin.create({ data: { userId: user.id, day, prize, claimedAt: new Date() } });
      await credit(user.id, prize, "wheel", `spin:${spin.id}`);
    } catch {
      // Two spins raced; the other one counted.
      const s = await db.wheelSpin.findUniqueOrThrow({ where: { userId_day: { userId: user.id, day } } });
      return { prize: s.prize, credited: true, already: true };
    }
    const balance = (await db.user.findUnique({ where: { id: user.id }, select: { tokenBalance: true } }))?.tokenBalance;
    revalidatePath("/", "layout");
    return { prize, credited: true, balance };
  }
  // Signed out: remember the spin in a cookie and hold the prize until they sign in.
  const jar = await cookies();
  const pendingId = jar.get(SPIN_COOKIE)?.value;
  if (pendingId) {
    const s = await db.wheelSpin.findUnique({ where: { id: pendingId } });
    if (s && s.day === day) return { prize: s.prize, credited: false, already: true };
  }
  const spin = await db.wheelSpin.create({ data: { day, prize: drawPrize() } });
  jar.set(SPIN_COOKIE, spin.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 3 * 864e2 });
  return { prize: spin.prize, credited: false };
}

/** After signing in, move a signed-out spin onto the account. One wheel prize per account per day. */
export async function claimSpin(): Promise<{ prize: number; balance: number } | null> {
  const user = await getUser();
  const jar = await cookies();
  const id = jar.get(SPIN_COOKIE)?.value;
  if (!user || !id) return null;
  jar.delete(SPIN_COOKIE);
  const spin = await db.wheelSpin.findUnique({ where: { id } });
  // Prizes can be collected for 2 days after the spin.
  if (!spin || spin.userId || spin.claimedAt || Date.now() - spin.createdAt.getTime() > 2 * 864e5) return null;
  try {
    await db.wheelSpin.update({ where: { id, userId: null }, data: { userId: user.id, claimedAt: new Date() } });
  } catch {
    return null; // this account already spun that day
  }
  await credit(user.id, spin.prize, "wheel", `spin:${spin.id}`);
  revalidatePath("/", "layout");
  const balance = (await db.user.findUnique({ where: { id: user.id }, select: { tokenBalance: true } }))?.tokenBalance ?? 0;
  return { prize: spin.prize, balance };
}

/* ---------- Article poll and comments ---------- */
export type ParticipationState = { ok?: boolean; earned?: number; error?: string } | null;

async function storyFor(postId: string) {
  return db.post.findFirst({ where: { id: postId, status: "published" }, select: { id: true, slug: true } });
}

export async function votePoll(_: ParticipationState, form: FormData): Promise<ParticipationState> {
  const postId = String(form.get("postId"));
  const choice = String(form.get("choice"));
  const post = await storyFor(postId);
  if (!post || !POLL_CHOICES.includes(choice as (typeof POLL_CHOICES)[number])) return { error: "invalid" };
  const user = await requireUser(`/story/${post.slug}#poll`);
  await db.pollVote.upsert({ where: { userId_postId: { userId: user.id, postId } }, create: { userId: user.id, postId, choice }, update: { choice } });
  const earned = (await credit(user.id, PARTICIPATION_REWARD, "poll", `poll:${user.id}:${postId}`)) ? PARTICIPATION_REWARD : 0;
  revalidatePath(`/story/${post.slug}`);
  return { ok: true, earned };
}

export async function addComment(_: ParticipationState, form: FormData): Promise<ParticipationState> {
  const { t } = await getI18n();
  const postId = String(form.get("postId"));
  const body = String(form.get("body") ?? "").trim().slice(0, 2000);
  const post = await storyFor(postId);
  if (!post) return { error: "invalid" };
  const user = await requireUser(`/story/${post.slug}#comments`);
  if (body.length < 2) return { error: t("commentTooShort") };
  // Light flood control: at most 5 comments a minute per account.
  const recent = await db.comment.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60e3) } } });
  if (recent >= 5) return { error: t("commentSlowDown") };
  await db.comment.create({ data: { userId: user.id, postId, body } });
  const earned = (await credit(user.id, PARTICIPATION_REWARD, "comment", `comment:${user.id}:${postId}`)) ? PARTICIPATION_REWARD : 0;
  revalidatePath(`/story/${post.slug}`);
  return { ok: true, earned };
}

export async function deleteOwnComment(form: FormData) {
  const user = await requireUser();
  const c = await db.comment.findUnique({ where: { id: String(form.get("id")) }, include: { post: { select: { slug: true } } } });
  if (!c || (c.userId !== user.id && user.role !== "ADMIN")) return;
  await db.comment.delete({ where: { id: c.id } });
  revalidatePath(`/story/${c.post.slug}`);
}

/* ---------- Article quiz ---------- */
export type QuizResult = { correct: number; earned: number; answers: number[]; already?: boolean; error?: string } | null;

/** One play per reader per article. Both answers right = QUIZ_REWARD tokens. */
export async function submitQuiz(_: QuizResult, form: FormData): Promise<QuizResult> {
  const postId = String(form.get("postId"));
  const post = await db.post.findFirst({ where: { id: postId, status: "published" }, select: { id: true, slug: true } });
  if (!post) return { correct: 0, earned: 0, answers: [], error: "invalid" };
  const user = await requireUser(`/story/${post.slug}#quiz`);
  const quiz = await getQuiz(postId);
  if (!quiz) return { correct: 0, earned: 0, answers: [], error: "invalid" };
  const answers = quiz.map((q) => q.answer);

  // The right answers are only revealed to readers who got both right; otherwise they're in the summary.
  const reveal = (correct: number) => (correct === quiz.length ? answers : []);
  const prior = await db.quizAttempt.findUnique({ where: { userId_postId: { userId: user.id, postId } } });
  if (prior) return { correct: prior.correct, earned: prior.earned, answers: reveal(prior.correct), already: true };

  const picks = quiz.map((_, i) => Number(form.get(`q${i}`)));
  if (picks.some((p) => !Number.isInteger(p) || p < 0 || p > 3)) return { correct: 0, earned: 0, answers: [], error: "answerAll" };
  const correct = picks.filter((p, i) => p === quiz[i].answer).length;
  const won = correct === quiz.length;
  try {
    await db.quizAttempt.create({ data: { userId: user.id, postId, correct, earned: won ? QUIZ_REWARD : 0 } });
  } catch {
    const p = await db.quizAttempt.findUniqueOrThrow({ where: { userId_postId: { userId: user.id, postId } } });
    return { correct: p.correct, earned: p.earned, answers: reveal(p.correct), already: true };
  }
  if (won) await credit(user.id, QUIZ_REWARD, "quiz", `quiz:${user.id}:${postId}`);
  revalidatePath(`/story/${post.slug}`);
  return { correct, earned: won ? QUIZ_REWARD : 0, answers: reveal(correct) };
}

/* ---------- Follow speakers and hosts ---------- */
export async function toggleFollow(form: FormData) {
  const kind = String(form.get("kind"));
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const back = String(form.get("back") || "/");
  if (!["speaker", "host"].includes(kind) || !name) return;
  const user = await requireUser(back);
  const key = { userId_kind_name: { userId: user.id, kind, name } };
  if (await db.follow.findUnique({ where: key })) await db.follow.delete({ where: key });
  else await db.follow.create({ data: { userId: user.id, kind, name } }).catch(() => null);
  revalidatePath(back.split("#")[0]);
  revalidatePath("/account");
}
