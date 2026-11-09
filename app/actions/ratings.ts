"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { credit, PARTICIPATION_REWARD } from "@/lib/tokens";
import { logActivity } from "@/lib/activity";

export type RatingState = { ok?: boolean; value?: number; earned?: number; up?: number; down?: number } | null;

/**
 * Like (+1) or dislike (-1) a speaker or host. Clicking the same button again removes the rating.
 * The first rating of each person pays the participation reward once; changing it later doesn't pay again.
 */
export async function ratePerson(_: RatingState, form: FormData): Promise<RatingState> {
  const kind = String(form.get("kind"));
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const value = Number(form.get("value")) === -1 ? -1 : 1;
  const back = String(form.get("back") || "/");
  if (!["speaker", "host", "story"].includes(kind) || !name) return null;
  const user = await requireUser(back);

  const key = { userId_kind_name: { userId: user.id, kind, name } };
  const existing = await db.personRating.findUnique({ where: key });
  let now: number;
  if (existing?.value === value) {
    await db.personRating.delete({ where: key });
    now = 0;
  } else {
    await db.personRating.upsert({ where: key, create: { userId: user.id, kind, name, value }, update: { value } });
    now = value;
  }
  const earned = now !== 0 && (await credit(user.id, PARTICIPATION_REWARD, "rating", `rating:${user.id}:${kind}:${name}`)) ? PARTICIPATION_REWARD : 0;
  const storyId = kind === "story" ? (await db.post.findUnique({ where: { slug: name }, select: { id: true } }))?.id ?? null : null;
  if (now !== 0) after(() => logActivity({ kind: "vote", userId: user.id, postId: storyId, detail: `${now > 0 ? "Liked" : "Disliked"} ${kind === "story" ? "the story" : `${kind} ${name}`}${earned ? ` (+${earned} tokens)` : ""}` }));

  const [up, down] = await Promise.all([
    db.personRating.count({ where: { kind, name, value: 1 } }),
    db.personRating.count({ where: { kind, name, value: -1 } }),
  ]);
  revalidatePath(back.split("#")[0]);
  return { ok: true, value: now, earned, up, down };
}
