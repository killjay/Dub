import ffmpeg from "fluent-ffmpeg";
import { ffprobeDuration } from "./ffmpeg.js";
import type { WordTimestamp } from "./types.js";

/**
 * v1: coarse global atempo to match overall duration. The transcription's
 * word timestamps are kept around for v2 (per-segment compress/stretch with
 * crossfades), where we'll sentence-split and align each chunk independently.
 *
 * atempo accepts 0.5–100×. For factors outside 0.5–2.0, chain multiple atempo
 * filters (FFmpeg requirement).
 */
export async function timeAlignAudio(opts: {
  ttsPath: string;
  targetDurationSec: number;
  sourceWords: WordTimestamp[];
  outPath: string;
}) {
  const ttsDur = await ffprobeDuration(opts.ttsPath);
  const factor = ttsDur / opts.targetDurationSec; // >1 → speed up, <1 → slow down

  const filters = atempoChain(factor);

  return new Promise<void>((resolve, reject) => {
    ffmpeg(opts.ttsPath)
      .audioFilter(filters.join(","))
      .on("error", reject)
      .on("end", () => resolve())
      .save(opts.outPath);
  });
}

function atempoChain(factor: number): string[] {
  if (!Number.isFinite(factor) || factor <= 0) return ["atempo=1.0"];
  const out: string[] = [];
  let f = factor;
  while (f > 2.0) { out.push("atempo=2.0"); f /= 2.0; }
  while (f < 0.5) { out.push("atempo=0.5"); f /= 0.5; }
  out.push(`atempo=${f.toFixed(4)}`);
  return out;
}
