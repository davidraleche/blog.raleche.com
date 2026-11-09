"use server";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buyMemoWithTokens } from "@/lib/memos";
import { logActivity } from "@/lib/activity";

export async function buyMemo(form: FormData) {
  const memoId = String(form.get("memoId"));
  const user = await requireUser("/memos");
  const result = await buyMemoWithTokens(user.id, memoId);
  if (result === "insufficient") redirect(`/store?need=1&next=${encodeURIComponent("/memos")}`);
  if (result === "unavailable") redirect("/memos?error=unavailable");
  if (result === "ok") {
    const memo = await db.memo.findUnique({ where: { id: memoId }, select: { title: true, priceTokens: true } });
    after(() => logActivity({ kind: "memo", userId: user.id, detail: `Bought the memo “${memo?.title}” (${memo?.priceTokens} tokens)` }));
  }
  revalidatePath("/memos");
  revalidatePath("/account/memos");
  redirect(`/account/memos?bought=${memoId}`);
}
