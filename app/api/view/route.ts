import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { today } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const { postId } = await req.json().catch(() => ({}));
  if (typeof postId !== "string") return NextResponse.json({}, { status: 400 });
  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({}, { status: 404 });
  await db.$transaction([
    db.post.update({ where: { id: postId }, data: { views: { increment: 1 } } }),
    db.postView.upsert({ where: { postId_day: { postId, day: today() } }, create: { postId, day: today(), count: 1 }, update: { count: { increment: 1 } } }),
  ]);
  return NextResponse.json({ ok: true });
}
