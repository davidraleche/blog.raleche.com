import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  if (!clientId) return NextResponse.redirect(`${appUrl}/signin?error=google_not_configured`);
  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" };
  res.cookies.set("g_state", state, opts);
  res.cookies.set("g_next", safeNext(req.nextUrl.searchParams.get("next")), opts);
  return res;
}
