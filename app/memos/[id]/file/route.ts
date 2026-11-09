import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ownsMemo } from "@/lib/memos";

/** Serve a memo's PDF to its buyers (and admins). `?download=1` saves it instead of opening it. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent("/account/memos")}`, req.url));
  if (user.role !== "ADMIN" && !(await ownsMemo(user.id, id))) return new NextResponse("Not found", { status: 404 });
  const memo = await db.memo.findUnique({ where: { id }, select: { fileData: true, fileName: true, fileType: true, slug: true } });
  if (!memo?.fileData) return new NextResponse("Not found", { status: 404 });
  const name = (memo.fileName || `${memo.slug}.pdf`).replace(/[^\w.\- ]/g, "_");
  const disposition = req.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(memo.fileData), {
    headers: {
      "Content-Type": memo.fileType || "application/pdf",
      "Content-Disposition": `${disposition}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
