import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { makeState } from "@/lib/oauth-state";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  if (!clientId) return NextResponse.redirect(`${appUrl}/signin?error=google_not_configured`);
  const state = makeState(safeNext(req.nextUrl.searchParams.get("next")));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  return NextResponse.redirect(url);
}
