// All 8 languages supported as both source AND target.
// Hindi (hi) and English (en) are global; the rest are major Indian languages.
export type Lang = "en" | "hi" | "ta" | "te" | "mr" | "bn" | "kn" | "bho";
export type SourceLang = Lang;
export type TargetLang = Lang;

export interface DubJobInput {
  jobId: string;
  userId: string;
  sourceR2Key: string;
  sourceLanguage: SourceLang;
  targetLanguages: TargetLang[];
  voicePreset: string;
  watermark: boolean; // free tier
  premiumLipSync: boolean; // Pro tier → LatentSync instead of MuseTalk
}

export interface WordTimestamp {
  word: string;
  startSec: number;
  endSec: number;
}

export interface AsrResult {
  text: string;
  words: WordTimestamp[];
  durationSec: number;
}

export interface DubOutput {
  language: TargetLang;
  videoR2Key: string;
  audioR2Key: string;
}

export type ProgressFn = (pct: number, label: string) => void;
