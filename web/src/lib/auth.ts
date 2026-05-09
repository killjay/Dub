import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE.name)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;
  const [user] = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);
  return user ?? null;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
