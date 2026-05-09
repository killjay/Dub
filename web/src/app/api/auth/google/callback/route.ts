import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { exchangeCodeForToken, fetchUserInfo, OAUTH_STATE_COOKIE } from "@/lib/oauth-google";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

const SIGN_IN = "/sign-in";

function fail(message: string) {
  const url = new URL(SIGN_IN, "http://placeholder");
  url.searchParams.set("oauth_error", message);
  // returning a relative path keeps redirects honest
  return NextResponse.redirect(`${SIGN_IN}?oauth_error=${encodeURIComponent(message)}`);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE.name)?.value;

  if (!code) return fail("Google sign-in cancelled.");
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return fail("Sign-in state mismatch — please try again.");
  }

  let access_token: string;
  let info: { sub: string; email: string; email_verified: boolean; name?: string };
  try {
    ({ access_token } = await exchangeCodeForToken(code));
    info = await fetchUserInfo(access_token);
  } catch (err) {
    console.error("[oauth/google]", err);
    return fail("Could not complete Google sign-in.");
  }

  if (!info.email_verified) {
    return fail("Google email is not verified.");
  }

  const email = info.email.toLowerCase().trim();
  const dbi = db();

  // 1) match by googleId, 2) match by email and link, 3) create new
  const [byGoogleId] = await dbi
    .select()
    .from(schema.users)
    .where(eq(schema.users.googleId, info.sub))
    .limit(1);

  let userId: string;
  if (byGoogleId) {
    userId = byGoogleId.id;
  } else {
    const [byEmail] = await dbi
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (byEmail) {
      await dbi
        .update(schema.users)
        .set({ googleId: info.sub })
        .where(eq(schema.users.id, byEmail.id));
      userId = byEmail.id;
    } else {
      const [created] = await dbi
        .insert(schema.users)
        .values({
          email,
          googleId: info.sub,
          plan: "free",
          minutesQuota: 2,
          minutesUsedThisMonth: 0,
        })
        .returning();
      userId = created.id;
    }
  }

  const token = createSessionToken(userId);
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set(SESSION_COOKIE.name, token, SESSION_COOKIE.options);
  // clear state cookie
  res.cookies.set(OAUTH_STATE_COOKIE.name, "", { ...OAUTH_STATE_COOKIE.options, maxAge: 0 });
  return res;
}
