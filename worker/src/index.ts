import { Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { eq, sql } from "drizzle-orm";
import { runDubPipeline } from "./pipeline/run.js";
import { db, schema } from "./db/index.js";
import type { DubJobInput } from "./pipeline/types.js";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error("[worker] REDIS_URL is required.");
  process.exit(1);
}

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const QUEUE = "dub";

const worker = new Worker<DubJobInput>(
  QUEUE,
  async (job) => {
    const data = job.data;
    console.log(`[worker] picked job ${data.jobId} (${data.targetLanguages.length} languages)`);

    await db
      .update(schema.jobs)
      .set({ status: "processing" })
      .where(eq(schema.jobs.id, data.jobId));

    try {
      const result = await runDubPipeline(data, (pct, label) => {
        job.updateProgress({ pct, label }).catch(() => {});
      });

      // Persist outputs.
      if (result.outputs.length > 0) {
        await db.insert(schema.jobOutputs).values(
          result.outputs.map((o) => ({
            jobId: data.jobId,
            language: o.language,
            videoR2Key: o.videoR2Key,
            audioR2Key: o.audioR2Key,
            watermarked: data.watermark,
          }))
        );
      }

      // Bill the user (round duration up to the next minute).
      if (result.durationSec) {
        const minutes = Math.ceil(result.durationSec / 60);
        await db
          .update(schema.users)
          .set({ minutesUsedThisMonth: sql`${schema.users.minutesUsedThisMonth} + ${minutes}` })
          .where(eq(schema.users.id, data.userId));
      }

      await db
        .update(schema.jobs)
        .set({
          status: "succeeded",
          durationSeconds: result.durationSec ? Math.round(result.durationSec) : null,
          completedAt: new Date(),
        })
        .where(eq(schema.jobs.id, data.jobId));

      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      const stack = err instanceof Error ? err.stack ?? "" : "";
      console.error(`[worker] job ${data.jobId} failed:`, msg);
      console.error(stack);
      await db
        .update(schema.jobs)
        .set({
          status: "failed",
          // Include the first stack frame so the DB has enough to debug
          errorMessage: `${msg}\n${stack.split("\n").slice(0, 5).join("\n")}`,
          completedAt: new Date(),
        })
        .where(eq(schema.jobs.id, data.jobId));
      throw err;
    }
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
    lockDuration: 30 * 60 * 1000,
  }
);

worker.on("ready", () => console.log(`[worker] ready · queue=${QUEUE}`));
worker.on("active", (job) => console.log(`[worker] active ${job.id}`));
worker.on("completed", (job) => console.log(`[worker] completed ${job.id}`));
worker.on("failed", (job, err) => console.error(`[worker] failed ${job?.id}`, err));

const events = new QueueEvents(QUEUE, { connection: connection.duplicate() });
events.on("waiting", ({ jobId }) => console.log(`[worker] queued ${jobId}`));

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received — draining`);
  await worker.close();
  await events.close();
  await connection.quit();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
