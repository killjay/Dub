import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { downloadFromR2, uploadToR2 } from "../clients/r2.js";
import { extractAudio, muxAudioOnVideo, addWatermark, ffprobeDuration } from "./ffmpeg.js";
import { sarvamAsr } from "../clients/sarvam.js";
import { sarvamTranslate } from "../clients/sarvam.js";
import { sarvamTts } from "../clients/sarvam.js";
import { runLipSync } from "../clients/replicate.js";
import { timeAlignAudio } from "./time-align.js";
import type { DubJobInput, DubOutput, ProgressFn } from "./types.js";

export async function runDubPipeline(
  input: DubJobInput,
  progress: ProgressFn
): Promise<{ outputs: DubOutput[]; durationSec: number }> {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), `dub-${input.jobId}-`));
  try {
    progress(2, "downloading source");
    const srcMp4 = path.join(work, "source.mp4");
    await downloadFromR2(input.sourceR2Key, srcMp4);

    const durationSec = await ffprobeDuration(srcMp4);
    progress(5, `source ${durationSec.toFixed(1)}s — extracting audio`);
    const srcWav = path.join(work, "source.wav");
    await extractAudio(srcMp4, srcWav);

    progress(10, "transcribing with Sarvam Saarika");
    const asr = await sarvamAsr(srcWav, input.sourceLanguage);

    // Per-language work in parallel — but cap concurrency to avoid Sarvam/Replicate rate limits.
    const outputs: DubOutput[] = [];
    const total = input.targetLanguages.length;
    const langPctSpan = 80 / total; // 10–90% range used for per-language work

    let i = 0;
    for (const lang of input.targetLanguages) {
      const base = 10 + i * langPctSpan;
      progress(base, `[${lang}] translating`);
      const translated = await sarvamTranslate(asr.text, input.sourceLanguage, lang);

      progress(base + langPctSpan * 0.25, `[${lang}] generating speech`);
      const ttsWav = path.join(work, `tts-${lang}.wav`);
      await sarvamTts({ text: translated, language: lang, voicePreset: input.voicePreset, outPath: ttsWav });

      progress(base + langPctSpan * 0.45, `[${lang}] aligning timing`);
      const alignedWav = path.join(work, `aligned-${lang}.wav`);
      await timeAlignAudio({
        ttsPath: ttsWav,
        targetDurationSec: durationSec,
        sourceWords: asr.words,
        outPath: alignedWav,
      });

      progress(base + langPctSpan * 0.65, `[${lang}] lip-syncing`);
      const lipSyncMp4 = path.join(work, `lipsync-${lang}.mp4`);
      await runLipSync({ videoPath: srcMp4, audioPath: alignedWav, outPath: lipSyncMp4 });

      progress(base + langPctSpan * 0.9, `[${lang}] muxing`);
      const finalMp4 = path.join(work, `final-${lang}.mp4`);
      await muxAudioOnVideo(lipSyncMp4, alignedWav, finalMp4);

      const deliverMp4 = input.watermark
        ? await addWatermark(finalMp4, path.join(work, `wm-${lang}.mp4`))
        : finalMp4;

      const videoKey = `outputs/${input.userId}/${input.jobId}/${lang}.mp4`;
      const audioKey = `outputs/${input.userId}/${input.jobId}/${lang}.wav`;
      await uploadToR2(deliverMp4, videoKey, "video/mp4");
      await uploadToR2(alignedWav, audioKey, "audio/wav");

      outputs.push({ language: lang, videoR2Key: videoKey, audioR2Key: audioKey });
      i += 1;
    }

    progress(100, "done");
    return { outputs, durationSec };
  } finally {
    fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
