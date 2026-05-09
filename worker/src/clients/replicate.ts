import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import fetch from "node-fetch";
import { presignGet, uploadToR2 } from "./r2.js";

const TOKEN = () => {
  const t = process.env.REPLICATE_API_TOKEN;
  if (!t) throw new Error("REPLICATE_API_TOKEN not set");
  return t;
};

// Lip-sync model selection.
//   "modal-musetalk" → our own MuseTalk v1.5 on Modal (handled by clients/modal.ts)
//   "musetalk"       → tmappdev/lipsync on Replicate (community MuseTalk)
//   "retalking"      → chenxwh/video-retalking
//   "latentsync"     → bytedance/latentsync
//   "wav2lip"        → cjwbw/wav2lip (cheap fallback)
// Override individually with REPLICATE_LIPSYNC_VERSION + REPLICATE_LIPSYNC_MODEL.
type LipSyncModel = "musetalk" | "retalking" | "latentsync" | "wav2lip";

const VERSIONS: Record<LipSyncModel, string> = {
  musetalk: "569bcd925698ea23d4bece4528546992012d84267ce2438ecc803618ce23764c",
  retalking: "db5a650c807b007dc5f9e5abe27c53e1b62880d1f94d218d27ce7fa802711d67",
  latentsync: "637ce1919f807ca20da3a448ddc2743535d2853649574cd52a933120e9b9e293",
  wav2lip: "8d65e3f4f4298520e079198b493c25adfc43c058ffec924f2aefc8010ed25eef",
};

function modelChoice(): LipSyncModel {
  const env = (process.env.REPLICATE_LIPSYNC_MODEL ?? "musetalk").toLowerCase();
  if (env === "musetalk" || env === "wav2lip" || env === "latentsync" || env === "retalking") return env;
  return "musetalk";
}

function modelVersion(): string {
  return process.env.REPLICATE_LIPSYNC_VERSION ?? VERSIONS[modelChoice()];
}

function buildInput(model: LipSyncModel, videoUrl: string, audioUrl: string) {
  switch (model) {
    case "musetalk":
      return { video_input: videoUrl, audio_input: audioUrl, bbox_shift: 0, fps: 25 };
    case "wav2lip":
      return { face: videoUrl, audio: audioUrl, pads: "0 10 0 0", smooth: true };
    case "retalking":
      return { face: videoUrl, input_audio: audioUrl };
    case "latentsync":
      return { video: videoUrl, audio: audioUrl };
  }
}

/**
 * Top-level lip-sync entry point. Dispatches to Modal (self-hosted MuseTalk) or Replicate.
 */
export async function runLipSync(opts: {
  videoPath: string;
  audioPath: string;
  outPath: string;
}): Promise<void> {
  const env = (process.env.REPLICATE_LIPSYNC_MODEL ?? "modal-latentsync").toLowerCase();
  if (env === "modal-latentsync") {
    const { runModalLatentSync, isLatentSyncConfigured } = await import("./modal.js");
    if (!isLatentSyncConfigured()) {
      throw new Error(
        "REPLICATE_LIPSYNC_MODEL=modal-latentsync but LATENTSYNC_MODAL_URL/LATENTSYNC_AUTH_KEY are unset"
      );
    }
    return runModalLatentSync(opts);
  }
  if (env === "modal-musetalk") {
    const { runModalMuseTalk, isMuseTalkConfigured } = await import("./modal.js");
    if (!isMuseTalkConfigured()) {
      throw new Error(
        "REPLICATE_LIPSYNC_MODEL=modal-musetalk but MUSETALK_MODAL_URL/MUSETALK_AUTH_KEY are unset"
      );
    }
    return runModalMuseTalk(opts);
  }
  return runReplicateLipSync(opts);
}

async function runReplicateLipSync(opts: {
  videoPath: string;
  audioPath: string;
  outPath: string;
}): Promise<void> {
  const model = modelChoice();
  const videoUrl = await ensureFetchable(opts.videoPath);
  const audioUrl = await ensureFetchable(opts.audioPath);

  const start = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { Authorization: `Token ${TOKEN()}`, "content-type": "application/json" },
    body: JSON.stringify({
      version: modelVersion(),
      input: buildInput(model, videoUrl, audioUrl),
    }),
  });
  if (!start.ok) throw new Error(`replicate start ${start.status}: ${await start.text()}`);
  const created = (await start.json()) as { id: string; urls: { get: string } };

  const deadline = Date.now() + 25 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(3_000);
    const r = await fetch(created.urls.get, { headers: { Authorization: `Token ${TOKEN()}` } });
    if (!r.ok) continue;
    const j = (await r.json()) as { status: string; output?: string | string[]; error?: string };
    if (j.status === "succeeded" && j.output) {
      const url = Array.isArray(j.output) ? j.output[0] : j.output;
      const dl = await fetch(url);
      if (!dl.ok) throw new Error(`lipsync download ${dl.status}`);
      await fs.writeFile(opts.outPath, Buffer.from(await dl.arrayBuffer()));
      return;
    }
    if (j.status === "failed" || j.status === "canceled") {
      throw new Error(`lipsync ${j.status}: ${j.error ?? "unknown"}`);
    }
  }
  throw new Error("lipsync timed out after 25 min");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureFetchable(localPath: string): Promise<string> {
  const ext = path.extname(localPath) || ".bin";
  const id = crypto.randomBytes(8).toString("hex");
  const key = `tmp/replicate/${id}${ext}`;
  const ct = ext === ".mp4" ? "video/mp4" : ext === ".wav" ? "audio/wav" : "application/octet-stream";
  await uploadToR2(localPath, key, ct);
  return presignGet(key, 60 * 30);
}
