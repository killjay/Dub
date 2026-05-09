import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Email + password (≥8 chars) required." }, { status: 400 });
  }

  const email = parsed.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(parsed.password, 10);

  let user;
  try {
    const dbi = db();
    const [row] = await dbi
      .insert(schema.users)
      .values({
        email,
        passwordHash,
        plan: "free",
        minutesQuota: 2,
        minutesUsedThisMonth: 0,
      })
      .returning();
    user = row;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    console.error("[sign-up]", err);
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }

  const token = createSessionToken(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE.name, token, SESSION_COOKIE.options);
  return res;
}
