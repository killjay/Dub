import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { isR2Configured, presignPut } from "@/lib/r2";

export const runtime = "nodejs";

const Body = z.object({
  filename: z.string().min(1).max(256),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive().max(500 * 1024 * 1024),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // TODO: pull userId from Clerk auth() once integrated.
  const userId = "anonymous";
  const id = crypto.randomUUID();
  const safe = parsed.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `uploads/${userId}/${id}/${safe}`;

  if (!isR2Configured()) {
    // Dev-mode echo: client can branch on this in future. For now just signal.
    return NextResponse.json(
      {
        error: "R2 is not configured. Set R2_* env vars or use the local dev fallback.",
        key,
      },
      { status: 503 }
    );
  }

  const { url, expiresAt } = presignPut({ key, contentType: parsed.contentType, expiresInSeconds: 900 });
  return NextResponse.json({ uploadUrl: url, key, expiresAt });
}
