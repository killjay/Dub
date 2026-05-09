import { Queue } from "bullmq";
import IORedis from "ioredis";

let queue: Queue | null = null;
let connection: IORedis | null = null;

export function getDubQueue(): Queue {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not set");
  }
  if (!queue) {
    connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    queue = new Queue("dub", { connection });
  }
  return queue;
}

export type DubJobInput = {
  jobId: string;
  userId: string;
  sourceR2Key: string;
  sourceLanguage: "hi" | "en";
  targetLanguages: ("ta" | "te" | "mr" | "bn" | "kn" | "bho" | "hi")[];
  voicePreset: string;
  watermark: boolean;
  premiumLipSync: boolean;
};
