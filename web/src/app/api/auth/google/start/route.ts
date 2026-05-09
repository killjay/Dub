import { NextResponse } from "next/server";
import { buildAuthUrl, isGoogleConfigured, newOAuthState, OAUTH_STATE_COOKIE } from "@/lib/oauth-google";

export const runtime = "nodejs";

export async function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET." },
      { status: 503 }
    );
  }
  const state = newOAuthState();
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set(OAUTH_STATE_COOKIE.name, state, OAUTH_STATE_COOKIE.options);
  return res;
}
