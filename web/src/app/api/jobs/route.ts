import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getDubQueue, type DubJobInput } from "@/lib/queue";

export const runtime = "nodejs";

const SUPPORTED = ["en", "hi", "ta", "te", "mr", "bn", "kn", "bho"] as const;

const Body = z.object({
  sourceR2Key: z.string().min(5),
  sourceLanguage: z.enum(SUPPORTED),
  targetLanguages: z.array(z.enum(SUPPORTED)).min(1).max(8),
  voicePreset: z.string().min(1).max(64),
  durationSeconds: z.number().positive().max(60 * 60).optional(),
}).refine(
  (b) => !b.targetLanguages.includes(b.sourceLanguage),
  { message: "Target languages must not include the source language" },
);

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const remaining = user.minutesQuota - user.minutesUsedThisMonth;
  if (remaining <= 0) {
    return NextResponse.json(
      { error: `You've used all ${user.minutesQuota} minutes for this month. Upgrade your plan.` },
      { status: 402 }
    );
  }

  const dbi = db();
  const [row] = await dbi
    .insert(schema.jobs)
    .values({
      userId: user.id,
      sourceR2Key: parsed.sourceR2Key,
      sourceLanguage: parsed.sourceLanguage,
      targetLanguages: parsed.targetLanguages,
      voicePreset: parsed.voicePreset,
      durationSeconds: parsed.durationSeconds ?? null,
      status: "queued",
    })
    .returning();

  const payload: DubJobInput = {
    jobId: row.id,
    userId: user.id,
    sourceR2Key: row.sourceR2Key,
    sourceLanguage: row.sourceLanguage as DubJobInput["sourceLanguage"],
    targetLanguages: row.targetLanguages as DubJobInput["targetLanguages"],
    voicePreset: row.voicePreset,
    watermark: user.plan === "free",
    premiumLipSync: user.plan === "pro",
  };

  try {
    const queue = getDubQueue();
    const bullJob = await queue.add("dub", payload, {
      jobId: row.id,
      attempts: 2,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
    await dbi.update(schema.jobs).set({ bullJobId: bullJob.id ?? null }).where(eq(schema.jobs.id, row.id));
  } catch (err) {
    await dbi
      .update(schema.jobs)
      .set({ status: "failed", errorMessage: err instanceof Error ? err.message : "queue failed" })
      .where(eq(schema.jobs.id, row.id));
    return NextResponse.json({ error: "Could not enqueue job. Is Redis running?" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, jobId: row.id });
}

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const dbi = db();
  const rows = await dbi
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.userId, user.id))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(50);
  return NextResponse.json({ jobs: rows });
}
