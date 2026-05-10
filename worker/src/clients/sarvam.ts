import fs from "node:fs/promises";
import fetch from "node-fetch";
import type { AsrResult, SourceLang, TargetLang } from "../pipeline/types.js";

const BASE = process.env.SARVAM_API_BASE ?? "https://api.sarvam.ai";

function key(): string {
  const k = process.env.SARVAM_API_KEY;
  if (!k) throw new Error("SARVAM_API_KEY not set");
  return k;
}

// Sarvam's exact endpoint shapes change — keep these adapters thin and easy to swap.
// Reference: https://docs.sarvam.ai/

export async function sarvamAsr(wavPath: string, lang: SourceLang): Promise<AsrResult> {
  const wav = await fs.readFile(wavPath);
  // Copy into a freshly-allocated, owned ArrayBuffer. fs.readFile returns a Node
  // Buffer that may share/pool its underlying memory; undici's multipart streaming
  // can detach it mid-upload, throwing
  // "Invalid state: chunk ArrayBuffer is zero-length or detached".
  const wavBytes = new Uint8Array(wav.byteLength);
  wavBytes.set(wav);
  const form = new FormData();
  form.append("file", new Blob([wavBytes], { type: "audio/wav" }), "audio.wav");
  form.append("language_code", SARVAM_LANG[lang]);
  form.append("model", "saarika:v2.5");
  form.append("with_timestamps", "true");

  // node-fetch accepts the global FormData but its types don't.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await fetch(`${BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": key() },
    body: form as any,
  });
  if (!r.ok) throw new Error(`saarika ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as {
    transcript: string;
    timestamps?: { words: { word: string; start_time_seconds: number; end_time_seconds: number }[] };
    duration?: number;
  };

  return {
    text: j.transcript,
    words:
      j.timestamps?.words.map((w) => ({
        word: w.word,
        startSec: w.start_time_seconds,
        endSec: w.end_time_seconds,
      })) ?? [],
    durationSec: j.duration ?? 0,
  };
}

const SARVAM_LANG: Record<SourceLang | TargetLang, string> = {
  hi: "hi-IN",
  en: "en-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  kn: "kn-IN",
  bho: "bho-IN", // Note: confirm exact code with Sarvam — Bhojpuri may need fallback
};

export async function sarvamTranslate(
  text: string,
  source: SourceLang,
  target: TargetLang
): Promise<string> {
  const r = await fetch(`${BASE}/translate`, {
    method: "POST",
    headers: { "api-subscription-key": key(), "content-type": "application/json" },
    body: JSON.stringify({
      input: text,
      source_language_code: SARVAM_LANG[source],
      target_language_code: SARVAM_LANG[target],
      mode: "formal",
      model: "mayura:v1",
    }),
  });
  if (!r.ok) throw new Error(`mayura ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { translated_text: string };
  return j.translated_text;
}

// Bulbul v2 speakers (as of 2026-05). Full list is large — these are sane defaults.
const VOICE_TO_SARVAM: Record<string, string> = {
  "warm-female": "anushka",
  "warm-male": "abhilash",
  "bright-female": "vidya",
  "bright-male": "karun",
};

export async function sarvamTts(opts: {
  text: string;
  language: TargetLang;
  voicePreset: string;
  outPath: string;
}): Promise<void> {
  const r = await fetch(`${BASE}/text-to-speech`, {
    method: "POST",
    headers: { "api-subscription-key": key(), "content-type": "application/json" },
    body: JSON.stringify({
      inputs: [opts.text],
      target_language_code: SARVAM_LANG[opts.language],
      speaker: VOICE_TO_SARVAM[opts.voicePreset] ?? "meera",
      model: "bulbul:v2",
      pitch: 0,
      pace: 1.0,
      loudness: 1.2,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
    }),
  });
  if (!r.ok) throw new Error(`bulbul ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { audios: string[] };
  if (!j.audios?.[0]) throw new Error("bulbul: empty audio");
  const buf = Buffer.from(j.audios[0], "base64");
  await fs.writeFile(opts.outPath, buf);
}
