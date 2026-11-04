import { NextResponse, type NextRequest } from "next/server";
import { setLangCookie } from "@/lib/auth";
import { isLocale } from "@/lib/i18n/messages";

/** /api/lang?l=fr saves the language and returns to the page the visitor was on. */
export async function GET(req: NextRequest) {
  const l = req.nextUrl.searchParams.get("l");
  if (isLocale(l)) await setLangCookie(l);
  const base = process.env.APP_URL || req.nextUrl.origin;
  let back = "/";
  try {
    const ref = new URL(req.headers.get("referer") ?? "");
    if (ref.host === new URL(base).host || ref.host === req.nextUrl.host) back = ref.pathname + ref.search;
  } catch {}
  return NextResponse.redirect(new URL(back, base));
}
