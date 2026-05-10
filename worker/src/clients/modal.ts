import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { presignGet, uploadToR2 } from "./r2.js";

export function isMuseTalkConfigured(): boolean {
  return Boolean(process.env.MUSETALK_MODAL_URL && process.env.MUSETALK_AUTH_KEY);
}

export function isLatentSyncConfigured(): boolean {
  return Boolean(process.env.LATENTSYNC_MODAL_URL && process.env.LATENTSYNC_AUTH_KEY);
}

// Back-compat alias used by older callers.
export const isModalConfigured = isMuseTalkConfigured;

/**
 * Self-hosted MuseTalk on Modal.
 */
export async function runModalMuseTalk(opts: {
  videoPath: string;
  audioPath: string;
  outPath: string;
}): Promise<void> {
  const url = process.env.MUSETALK_MODAL_URL;
  const key = process.env.MUSETALK_AUTH_KEY;
  if (!url || !key) throw new Error("MUSETALK_MODAL_URL / MUSETALK_AUTH_KEY not set");

  const videoUrl = await stageToR2(opts.videoPath);
  const audioUrl = await stageToR2(opts.audioPath);

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      auth: key,
      video_url: videoUrl,
      audio_url: audioUrl,
      bbox_shift: 0,
      fps: 25,
      version: "v15",
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`modal musetalk ${r.status}: ${body.slice(0, 500)}`);
  }
  await fs.writeFile(opts.outPath, Buffer.from(await r.arrayBuffer()));
}

/**
 * Self-hosted LatentSync v1.6 on Modal.
 */
export async function runModalLatentSync(opts: {
  videoPath: string;
  audioPath: string;
  outPath: string;
}): Promise<void> {
  const url = process.env.LATENTSYNC_MODAL_URL;
  const key = process.env.LATENTSYNC_AUTH_KEY;
  if (!url || !key) throw new Error("LATENTSYNC_MODAL_URL / LATENTSYNC_AUTH_KEY not set");

  const videoUrl = await stageToR2(opts.videoPath);
  const audioUrl = await stageToR2(opts.audioPath);

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      auth: key,
      video_url: videoUrl,
      audio_url: audioUrl,
      // Higher inference_steps = sharper output, linearly slower.
      // 50 is LatentSync's documented upper bound (predict.py: le=50).
      inference_steps: Number(process.env.LATENTSYNC_INFERENCE_STEPS ?? 50),
      // 1.0–3.0; higher = stricter adherence to audio (better lip-sync precision).
      guidance_scale: Number(process.env.LATENTSYNC_GUIDANCE_SCALE ?? 2.0),
      seed: 0,
      version: "v16",
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`modal latentsync ${r.status}: ${body.slice(0, 500)}`);
  }
  await fs.writeFile(opts.outPath, Buffer.from(await r.arrayBuffer()));
}

async function stageToR2(localPath: string): Promise<string> {
  const ext = path.extname(localPath) || ".bin";
  const id = crypto.randomBytes(8).toString("hex");
  const key = `tmp/modal/${id}${ext}`;
  const ct = ext === ".mp4" ? "video/mp4" : ext === ".wav" ? "audio/wav" : "application/octet-stream";
  await uploadToR2(localPath, key, ct);
  return presignGet(key, 60 * 30);
}
