import { NextResponse, type NextRequest } from "next/server";
import { createSession, upsertUser, safeNext } from "@/lib/auth";
import { readState } from "@/lib/oauth-state";

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const st = readState(state);
  if (!code || !st) return NextResponse.redirect(`${appUrl}/signin?error=google_state`);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const token = await tokenRes.json();
  if (!token.access_token) return NextResponse.redirect(`${appUrl}/signin?error=google_token`);

  const profile = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } })).json();
  if (!profile.sub || !profile.email) return NextResponse.redirect(`${appUrl}/signin?error=google_profile`);

  const user = await upsertUser({ googleId: profile.sub, email: profile.email }, { name: profile.name, image: profile.picture }, profile.email_verified === true);
  await createSession(user.id);
  const res = NextResponse.redirect(`${appUrl}${safeNext(st.next)}`);
  return res;
}
