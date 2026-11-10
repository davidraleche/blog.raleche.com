import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";

/** Everything about a memo except the file bytes, for lists. */
export const memoListSelect = {
  id: true, slug: true, title: true, summary: true, priceTokens: true, active: true, sortOrder: true,
  fileName: true, fileType: true, fileSize: true, postId: true, updatedAt: true,
  post: { select: { slug: true, title: true, coverImage: true } },
} satisfies Prisma.MemoSelect;

/** A memo priced at 0 tokens is a free sample: anyone can read it, no purchase or sign-in needed. */
export const isFreeMemo = (m: { priceTokens: number }) => m.priceTokens === 0;

export const ownsMemo = async (userId: string | undefined, memoId: string) =>
  !!userId && !!(await db.memoPurchase.findUnique({ where: { userId_memoId: { userId, memoId } }, select: { id: true } }));

/** Spend tokens on a memo. Returns "ok", "already", "insufficient" or "unavailable". */
export async function buyMemoWithTokens(userId: string, memoId: string): Promise<"ok" | "already" | "insufficient" | "unavailable"> {
  const memo = await db.memo.findUnique({ where: { id: memoId }, select: { active: true, priceTokens: true, fileSize: true } });
  if (!memo?.active || !memo.fileSize) return "unavailable";
  if (memo.priceTokens === 0) return "already"; // free sample: nothing to buy
  if (await ownsMemo(userId, memoId)) return "already";
  const cost = memo.priceTokens;
  try {
    return await db.$transaction(async (tx) => {
      // Only decrement if the balance covers it, so two clicks can't overspend.
      const paid = await tx.user.updateMany({ where: { id: userId, tokenBalance: { gte: cost } }, data: { tokenBalance: { decrement: cost } } });
      if (paid.count === 0) return "insufficient" as const;
      const p = await tx.memoPurchase.create({ data: { userId, memoId, tokens: cost } });
      await tx.tokenTxn.create({ data: { userId, amount: -cost, reason: "memo", ref: `memo:${p.id}`, note: memoId } });
      return "ok" as const;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "already";
    throw e;
  }
}

/**
 * Create memo entries for the Executive Briefs listed by Tech Team Strategy (titles and summaries only),
 * linked to the matching story. Existing memos are left alone. Files are uploaded in the admin.
 */
export async function importMemoList() {
  const base = (process.env.TTS42_URL ?? "https://tech-team-strategy.com").replace(/\/$/, "");
  const res = await fetch(`${base}/api/briefs`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Brief list returned ${res.status}`);
  const { briefs } = (await res.json()) as { briefs: { id: string; title: string; summary: string; articleUrl: string | null }[] };
  let created = 0;
  for (const [i, b] of briefs.entries()) {
    const slug = b.id.replace(/^brief-/, "");
    if (await db.memo.findUnique({ where: { slug }, select: { id: true } })) continue;
    const articleSlug = b.articleUrl?.split("/").filter(Boolean).pop();
    const post = articleSlug
      ? await db.post.findFirst({ where: { OR: [{ slug: articleSlug }, { sourceUrl: { endsWith: `/${articleSlug}` } }] }, select: { id: true } })
      : null;
    await db.memo.create({ data: { slug, title: b.title, summary: b.summary, postId: post?.id ?? null, sortOrder: i } });
    created++;
  }
  return { created, total: briefs.length };
}
