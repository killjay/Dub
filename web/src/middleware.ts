import { NextRequest, NextResponse } from "next/server";

// IMPORTANT: middleware runs on the Edge runtime — node:crypto's createHmac is
// available in modern Next, but to keep this dead-simple we only do a
// presence/format check here. Full HMAC verification happens server-side in
// `lib/session.ts` via `getSessionUser()` (Node runtime).

const PROTECTED_PREFIXES = ["/dashboard"];
const PROTECTED_API_PREFIXES = ["/api/jobs"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("dk_session")?.value;
  const looksValid = typeof token === "string" && token.split(".").length === 3;

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!looksValid) {
      const url = req.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!looksValid) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/jobs/:path*",
  ],
};
