import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canReadSummaries, getUser } from "@/lib/auth";
import { hasUnlocked } from "@/lib/tokens";
import { getI18n } from "@/lib/i18n/server";
import { translateMany } from "@/lib/translate";
import { markdownBlocks, summaryPdf } from "@/lib/summary-pdf";

export const dynamic = "force-dynamic";

/** The executive summary as a PDF, for readers who unlocked it (or can read all summaries). */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await db.post.findUnique({ where: { slug }, select: { id: true, slug: true, title: true, speaker: true, status: true, executiveSummary: true } });
  if (!post?.executiveSummary || post.status !== "published") return new NextResponse("Not found", { status: 404 });
  const user = await getUser();
  const back = `/story/${post.slug}`;
  if (!user) return NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(back)}`, process.env.APP_URL || "https://raleche.com"));
  if (!(user.role === "ADMIN" || canReadSummaries(user) || (await hasUnlocked(user.id, post.id)))) {
    return NextResponse.redirect(new URL(`${back}#summary`, process.env.APP_URL || "https://raleche.com"));
  }

  const { locale, t } = await getI18n();
  let blocks = markdownBlocks(post.executiveSummary);
  let title = post.title;
  // French and Spanish fit the PDF's built-in fonts; Chinese readers get the English original.
  if (locale === "fr" || locale === "es") {
    const out = await translateMany(locale, [title, ...blocks.map((b) => b.text)]);
    title = out[0] || title;
    blocks = blocks.map((b, i) => ({ ...b, text: out[i + 1] || b.text }));
  }
  const url = `${(process.env.APP_URL || "https://raleche.com").replace(/\/$/, "")}${back}`;
  const pdf = await summaryPdf({
    title, speaker: post.speaker, url, label: locale === "zh" ? "Executive summary" : t("executiveSummary"), blocks,
    footer: `${url.replace(/^https?:\/\//, "")} · ${user.email ?? ""}`,
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="RALECHE-summary-${post.slug}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
