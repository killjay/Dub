import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Email + password required." }, { status: 400 });
  }

  const email = parsed.email.toLowerCase().trim();

  const [user] = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  // Always run bcrypt — even when user is missing or Google-only — to keep response time uniform.
  const stored = user?.passwordHash ?? "$2b$10$0000000000000000000000000000000000000000000000000000";
  const ok = await bcrypt.compare(parsed.password, stored);

  if (!user || !user.passwordHash || !ok) {
    if (user && !user.passwordHash) {
      return NextResponse.json(
        { error: "This account uses Google sign-in. Click \"Continue with Google\"." },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const token = createSessionToken(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE.name, token, SESSION_COOKIE.options);
  return res;
}
