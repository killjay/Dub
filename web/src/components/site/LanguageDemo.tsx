"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Lang = {
  code: string;
  name: string;
  native: string;
  sample: string;
  // sampleAudio?: string;  // wire up when you have R2 URLs
};

const LANGUAGES: Lang[] = [
  {
    code: "hi",
    name: "Hindi (source)",
    native: "हिन्दी",
    sample:
      "नमस्ते! आज हम बात करेंगे म्यूचुअल फंड में SIP कैसे शुरू करें। पहला कदम है — अपना KYC पूरा करना।",
  },
  {
    code: "ta",
    name: "Tamil",
    native: "தமிழ்",
    sample:
      "வணக்கம்! இன்று நாம் SIP-ஐ எப்படி தொடங்குவது என்று பார்ப்போம். முதல் படி — உங்கள் KYC-ஐ முடிப்பது.",
  },
  {
    code: "te",
    name: "Telugu",
    native: "తెలుగు",
    sample:
      "నమస్తే! ఈరోజు SIP ఎలా ప్రారంభించాలో మాట్లాడుకుందాం. మొదటి అడుగు — మీ KYC పూర్తి చేయడం.",
  },
  {
    code: "mr",
    name: "Marathi",
    native: "मराठी",
    sample:
      "नमस्कार! आज आपण SIP कशी सुरू करायची ते पाहूया. पहिली पायरी — तुमचं KYC पूर्ण करणं.",
  },
  {
    code: "bn",
    name: "Bengali",
    native: "বাংলা",
    sample:
      "নমস্কার! আজ আমরা কথা বলব SIP কীভাবে শুরু করবেন। প্রথম ধাপ — আপনার KYC সম্পূর্ণ করা।",
  },
  {
    code: "kn",
    name: "Kannada",
    native: "ಕನ್ನಡ",
    sample:
      "ನಮಸ್ಕಾರ! ಇಂದು ನಾವು SIP ಅನ್ನು ಹೇಗೆ ಪ್ರಾರಂಭಿಸಬೇಕೆಂದು ಮಾತನಾಡೋಣ. ಮೊದಲ ಹೆಜ್ಜೆ — ನಿಮ್ಮ KYC ಪೂರ್ಣಗೊಳಿಸುವುದು.",
  },
  {
    code: "bho",
    name: "Bhojpuri",
    native: "भोजपुरी",
    sample:
      "नमस्कार! आज हमनी के बात करब कि SIP कइसे शुरू कइल जाला। पहिला कदम बा — आपन KYC पूरा करल।",
  },
];

export function LanguageDemo() {
  const [active, setActive] = useState(LANGUAGES[1].code);
  const source = LANGUAGES[0];
  const target = LANGUAGES.find((l) => l.code === active)!;

  return (
    <section id="languages" className="border-t border-border bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Same creator. Same energy. Six languages.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Pick a language to preview the dubbed transcript. Voice + lip-sync rolls out in v1.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {LANGUAGES.slice(1).map((l) => (
            <button
              key={l.code}
              onClick={() => setActive(l.code)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                active === l.code
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              )}
            >
              {l.native} <span className="ml-1 text-xs opacity-70">{l.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DemoCard title="Source · Hindi" lang={source} accent="muted" />
          <DemoCard title={`Dubbed · ${target.name}`} lang={target} accent="primary" />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Translations shown for product preview only. Production output uses Sarvam Mayura
          translation + Bulbul TTS + MuseTalk lip-sync.
        </p>
      </div>
    </section>
  );
}

function DemoCard({
  title,
  lang,
  accent,
}: {
  title: string;
  lang: Lang;
  accent: "muted" | "primary";
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-6 sm:p-8",
        accent === "primary"
          ? "border-primary/30 bg-background shadow-md"
          : "border-border bg-background"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{lang.native}</span>
      </div>

      {/* video placeholder — drop real <video> here once samples are on R2 */}
      <div className="mt-4 aspect-[9/16] max-h-72 w-full overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-700 sm:max-h-80">
        <div className="flex h-full items-center justify-center text-xs text-white/60">
          [reel preview · {lang.code}]
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-foreground/90">{lang.sample}</p>
    </div>
  );
}
