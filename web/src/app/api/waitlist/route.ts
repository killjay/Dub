import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email().max(320),
  channel: z.string().url().max(500),
});

const FALLBACK_FILE = path.join(process.cwd(), ".waitlist.local.json");

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid email or channel URL." }, { status: 400 });
  }

  const referrer = req.headers.get("referer") ?? null;
  const url = new URL(req.url);
  const utm: Record<string, string> = {};
  for (const [k, v] of url.searchParams) if (k.startsWith("utm_")) utm[k] = v;

  if (process.env.DATABASE_URL) {
    const { db, schema } = await import("@/db");
    try {
      await db().insert(schema.waitlist).values({
        email: parsed.email.toLowerCase().trim(),
        channelUrl: parsed.channel.trim(),
        referrer,
        utm,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        return NextResponse.json({ ok: true, deduped: true });
      }
      console.error("[waitlist] db insert failed", err);
      return NextResponse.json({ error: "Could not save your email." }, { status: 500 });
    }
  } else {
    // Local-dev fallback so the form works without a DB.
    const row = {
      email: parsed.email.toLowerCase().trim(),
      channelUrl: parsed.channel.trim(),
      referrer,
      utm,
      createdAt: new Date().toISOString(),
    };
    let existing: typeof row[] = [];
    try {
      existing = JSON.parse(await fs.readFile(FALLBACK_FILE, "utf8"));
    } catch {
      // file may not exist yet
    }
    if (!existing.some((r) => r.email === row.email)) existing.push(row);
    await fs.writeFile(FALLBACK_FILE, JSON.stringify(existing, null, 2), "utf8");
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  // Ops convenience: count entries (no PII returned)
  if (!process.env.DATABASE_URL) {
    try {
      const data = JSON.parse(await fs.readFile(FALLBACK_FILE, "utf8")) as unknown[];
      return NextResponse.json({ count: data.length, source: "local-file" });
    } catch {
      return NextResponse.json({ count: 0, source: "local-file" });
    }
  }
  const { db, schema } = await import("@/db");
  const rows = await db().select({ id: schema.waitlist.id }).from(schema.waitlist);
  return NextResponse.json({ count: rows.length, source: "db" });
}
