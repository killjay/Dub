import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
if (ffprobeStatic?.path) ffmpeg.setFfprobePath(ffprobeStatic.path);

export function ffprobeDuration(input: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(input, (err, data) => {
      if (err) return reject(err);
      const dur = data.format?.duration;
      if (typeof dur !== "number") return reject(new Error("ffprobe: missing duration"));
      resolve(dur);
    });
  });
}

export function extractAudio(input: string, outWav: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .noVideo()
      .audioFrequency(16_000)
      .audioChannels(1)
      .audioCodec("pcm_s16le")
      .format("wav")
      .on("error", reject)
      .on("end", () => resolve())
      .save(outWav);
  });
}

export function muxAudioOnVideo(videoIn: string, audioIn: string, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoIn)
      .input(audioIn)
      .outputOptions(["-c:v copy", "-c:a aac", "-b:a 160k", "-map 0:v:0", "-map 1:a:0", "-shortest"])
      .on("error", reject)
      .on("end", () => resolve())
      .save(out);
  });
}

// 3-second "Made with DubKaroo" intro overlay for the free tier.
// Replace OVERLAY_PNG with a real asset before launch.
const OVERLAY_PNG = process.env.WATERMARK_PNG ?? "";

export function addWatermark(videoIn: string, out: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!OVERLAY_PNG) {
      // Soft fallback: copy through unchanged. We still log for ops awareness.
      console.warn("[ffmpeg] WATERMARK_PNG not set — skipping watermark overlay");
      ffmpeg(videoIn)
        .outputOptions(["-c copy"])
        .on("error", reject)
        .on("end", () => resolve(out))
        .save(out);
      return;
    }
    ffmpeg(videoIn)
      .input(OVERLAY_PNG)
      .complexFilter([
        "[1:v]format=rgba,colorchannelmixer=aa=0.85[wm]",
        "[0:v][wm]overlay=20:20:enable='between(t,0,3)'",
      ])
      .outputOptions(["-c:a copy"])
      .on("error", reject)
      .on("end", () => resolve(out))
      .save(out);
  });
}
