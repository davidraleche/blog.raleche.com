"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser, requireUser } from "@/lib/auth";
import { stripe, ensureStripeCustomer } from "@/lib/stripe";
import { getI18n, getLocale } from "@/lib/i18n/server";
import { today } from "@/lib/utils";
import { credit, drawPrize, findPack, unlockWithTokens, PARTICIPATION_REWARD, POLL_CHOICES, QUIZ_REWARD } from "@/lib/tokens";
import { getQuiz } from "@/lib/quiz";
import { after } from "next/server";
import { logActivity } from "@/lib/activity";
import { checkComment, MAX_COMMENT } from "@/lib/comment-guard";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";
const SPIN_COOKIE = "wheel_spin";
const SPUN_COOKIE = "wheel_day"; // this browser already spun today (signed in or not)

async function markSpun(day: string) {
  (await cookies()).set(SPUN_COOKIE, day, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 2 * 86400 });
}

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

  let url: string | null = null;
  try {
    const customerId = await ensureStripeCustomer(user);
    const metadata = { kind: "tokens", userId: user.id, tokens: String(pack.tokens), pack: pack.id };
    const session = await stripe.checkout.sessions.create({
      locale: await getLocale(),
      mode: "payment",
      customer: customerId,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: pack.cents, product_data: { name: `Raleche ${pack.tokens} tokens` } } }],
      metadata,
      payment_intent_data: { metadata },
      // Offer a "save my card" checkbox, and show cards saved that way on the next purchase. Stripe holds the card.
      saved_payment_method_options: { payment_method_save: "enabled" },
      invoice_creation: { enabled: true }, // so the purchase shows on the account's Invoices page
      success_url: `${appUrl()}/store?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/store`,
    });
    url = session.url;
  } catch (e) {
    // Stripe refused (e.g. the live account isn't activated yet): tell the buyer instead of crashing the page.
    console.error("[store] checkout failed:", (e as Error)?.message);
  }
  redirect(url ?? "/store?unavailable=1");
}

/* ---------- Executive summaries ---------- */
export async function unlockSummary(form: FormData) {
  const postId = String(form.get("postId"));
  const back = String(form.get("back") || "/");
  const user = await requireUser(back);
  const result = await unlockWithTokens(user.id, postId);
  if (result === "ok") after(() => logActivity({ kind: "unlock", userId: user.id, postId, detail: "Unlocked the executive summary (100 tokens)" }));
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
    if (done) { await markSpun(day); return { prize: done.prize, credited: true, already: true, balance: user.tokenBalance }; }
    const prize = drawPrize();
    try {
      const spin = await db.wheelSpin.create({ data: { userId: user.id, day, prize, claimedAt: new Date() } });
      await credit(user.id, prize, "wheel", `spin:${spin.id}`);
      after(() => logActivity({ kind: "spin", userId: user.id, detail: `Spun the wheel and won ${prize} token${prize === 1 ? "" : "s"}` }));
    } catch {
      // Two spins raced; the other one counted.
      const s = await db.wheelSpin.findUniqueOrThrow({ where: { userId_day: { userId: user.id, day } } });
      return { prize: s.prize, credited: true, already: true };
    }
    const balance = (await db.user.findUnique({ where: { id: user.id }, select: { tokenBalance: true } }))?.tokenBalance;
    await markSpun(day);
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
  await markSpun(day);
  jar.set(SPIN_COOKIE, spin.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 3 * 864e2 });
  return { prize: spin.prize, credited: false };
}

/** After signing in, move a signed-out spin onto the account. One wheel prize per account per day. */
export type ClaimResult = { status: "collected"; prize: number; balance: number } | { status: "already"; prize: number; todaysPrize: number } | null;

export async function claimSpin(): Promise<ClaimResult> {
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
    // One prize per account per day: this account already spun on that day. Tell them instead of failing silently.
    const todays = await db.wheelSpin.findUnique({ where: { userId_day: { userId: user.id, day: spin.day } } });
    return { status: "already", prize: spin.prize, todaysPrize: todays?.prize ?? 0 };
  }
  await credit(user.id, spin.prize, "wheel", `spin:${spin.id}`);
  after(() => logActivity({ kind: "spin", userId: user.id, detail: `Spun the wheel before signing in, won ${spin.prize} token${spin.prize === 1 ? "" : "s"}, then signed in to collect` }));
  revalidatePath("/", "layout");
  const balance = (await db.user.findUnique({ where: { id: user.id }, select: { tokenBalance: true } }))?.tokenBalance ?? 0;
  return { status: "collected", prize: spin.prize, balance };
}

/* ---------- Article poll and comments ---------- */
export type ParticipationState = { ok?: boolean; earned?: number; error?: string; held?: boolean } | null;

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
  const label = ({ great: "Great", average: "Average", not_great: "Not great" } as Record<string, string>)[choice] ?? choice;
  after(() => logActivity({ kind: "vote", userId: user.id, postId, detail: `Voted "${label}"${earned ? ` (+${earned} tokens)` : " (changed vote)"}` }));
  revalidatePath(`/story/${post.slug}`);
  return { ok: true, earned };
}

export async function addComment(_: ParticipationState, form: FormData): Promise<ParticipationState> {
  const { t } = await getI18n();
  const postId = String(form.get("postId"));
  const post = await storyFor(postId);
  if (!post) return { error: "invalid" };
  const user = await requireUser(`/story/${post.slug}#comments`);
  const check = await checkComment({
    user, postId,
    raw: String(form.get("body") ?? "").slice(0, MAX_COMMENT * 2),
    honeypot: String(form.get("website") ?? ""),
    stamp: String(form.get("stamp") ?? ""),
  });
  if (!check.ok) {
    if (check.silent) return { ok: true, earned: 0 }; // bots get no hint
    const msg = { tooShort: t("commentTooShort"), tooLong: t("commentTooLong"), links: t("commentLinksBlocked"), slowDown: t("commentSlowDown"), limit: t("commentLimit"), duplicate: t("commentDuplicate"), blocked: t("commentBlocked") }[check.error];
    return { error: msg };
  }
  const held = !!check.hold;
  const comment = await db.comment.create({ data: { userId: user.id, postId, body: check.body, hidden: held, heldReason: check.hold, rewarded: !held } });
  if (held) {
    console.warn(`[comments] held ${comment.id} for review: ${check.hold}`);
    after(() => logActivity({ kind: "comment", userId: user.id, postId, detail: `HELD FOR REVIEW (${check.hold}): "${check.body.slice(0, 300)}"` }));
    revalidatePath(`/story/${post.slug}`);
    return { ok: true, earned: 0, held: true };
  }
  const earned = (await credit(user.id, PARTICIPATION_REWARD, "comment", `comment:${user.id}:${postId}`)) ? PARTICIPATION_REWARD : 0;
  after(() => logActivity({ kind: "comment", userId: user.id, postId, detail: `"${check.body.slice(0, 300)}"` }));
  revalidatePath(`/story/${post.slug}`);
  return { ok: true, earned };
}

/** Readers flag a comment; 3 reports hide it until an admin looks. */
export async function reportComment(form: FormData) {
  const user = await requireUser();
  const c = await db.comment.findUnique({ where: { id: String(form.get("id")) }, include: { post: { select: { slug: true } } } });
  if (!c || c.userId === user.id) return;
  try {
    await db.commentReport.create({ data: { commentId: c.id, userId: user.id } });
  } catch {
    return; // already reported by this reader
  }
  const updated = await db.comment.update({ where: { id: c.id }, data: { reports: { increment: 1 } } });
  if (updated.reports >= 3 && !updated.hidden) await db.comment.update({ where: { id: c.id }, data: { hidden: true, heldReason: `reported by ${updated.reports} readers` } });
  revalidatePath(`/story/${c.post.slug}`);
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
  after(() => logActivity({ kind: "quiz", userId: user.id, postId, detail: `${correct} of ${quiz.length} right${won ? ` (+${QUIZ_REWARD} tokens)` : ""}` }));
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
  else {
    await db.follow.create({ data: { userId: user.id, kind, name } }).catch(() => null);
    after(() => logActivity({ kind: "follow", userId: user.id, detail: `Followed ${kind} ${name}` }));
  }
  revalidatePath(back.split("#")[0]);
  revalidatePath("/account");
}
