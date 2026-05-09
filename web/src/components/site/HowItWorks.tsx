import { Upload, Languages, Wand2, Share2 } from "lucide-react";

const STEPS = [
  {
    icon: Upload,
    title: "Upload",
    body: "Drag a Hindi or English MP4 (≤10 min, ≤500 MB). We pre-check audio & resolution in 2 seconds.",
  },
  {
    icon: Languages,
    title: "Pick languages",
    body: "Choose from Tamil, Telugu, Marathi, Bengali, Kannada, Bhojpuri (and Hindi if your source is English).",
  },
  {
    icon: Wand2,
    title: "We dub & lip-sync",
    body: "Sarvam Saarika (ASR) → Mayura (translate) → Bulbul (TTS) → MuseTalk (lip-sync). All in parallel.",
  },
  {
    icon: Share2,
    title: "Get notified",
    body: "MP4 + audio-only WAV land in your dashboard in <8 min. WhatsApp & email ping when done.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            One pipeline. Four steps. Zero studio overhead.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Built on Sarvam, AI4Bharat, and MuseTalk — the only stack that gets retroflex
            phonemes (ट/ड/ण) right.
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="relative rounded-2xl border border-border bg-background p-6"
            >
              <div className="absolute -top-3 left-6 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </div>
              <s.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
