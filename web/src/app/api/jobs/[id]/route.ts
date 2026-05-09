import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const { id } = await params;
  const dbi = db();
  const [job] = await dbi
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.id, id), eq(schema.jobs.userId, user.id)))
    .limit(1);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const outputs = await dbi
    .select()
    .from(schema.jobOutputs)
    .where(eq(schema.jobOutputs.jobId, id));

  // Sign GET URLs for outputs the user can play in-browser.
  const { presignGet, isR2Configured } = await import("@/lib/r2");
  const signedOutputs = outputs.map((o) => ({
    ...o,
    videoUrl: isR2Configured() ? presignGet(o.videoR2Key, 60 * 60) : null,
    audioUrl: isR2Configured() ? presignGet(o.audioR2Key, 60 * 60) : null,
  }));

  return NextResponse.json({ job, outputs: signedOutputs });
}
