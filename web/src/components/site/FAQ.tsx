const QUESTIONS = [
  {
    q: "How is this different from HeyGen / ElevenLabs?",
    a: "Both have weak Indic quality and USD pricing. We're built on Sarvam Bulbul + AI4Bharat — models that nail retroflex consonants (ट/ड/ण/ड़) and Dravidian phonemes that Western TTS muddles. And ₹2,499 vs $30+ matters when you're an Indian creator.",
  },
  {
    q: "Will YouTube flag my dubbed videos?",
    a: "No — YouTube explicitly permits AI-dubbed versions of your own content. You just need to disclose 'altered or synthetic content' in the upload form. We give you a one-click guide in the dashboard.",
  },
  {
    q: "What about my background music?",
    a: "v1 assumes voice-dominant audio (we'll show a warning if music is loud). v2 ships music-stem preservation via Sarvam Mukta-Vaani — keep your BGM, swap only the vocals.",
  },
  {
    q: "Can it clone my own voice?",
    a: "Voice cloning ships in v2 (months 4–5) with a mandatory consent recording. v1 uses 4–6 stock voices that match common YouTube energy — bright/warm, m/f.",
  },
  {
    q: "Refund if the output sucks?",
    a: "Yes. If a job fails our QA bar (lip-sync drift, audio glitch), we re-run on us. If it still fails, we credit the minutes back. Reputation matters more than ₹49 in our world.",
  },
  {
    q: "DPDP / privacy?",
    a: "Encrypted at rest (R2), TLS in transit, role-based access logs ≥1 year. Privacy notice + explicit consent at signup. We don't train models on your videos.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="border-t border-border bg-muted/30 py-20">
      <div className="mx-auto max-w-3xl px-5">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Frequently asked
        </h2>
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-background">
          {QUESTIONS.map(({ q, a }) => (
            <details key={q} className="group p-6 open:bg-muted/40">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                <span className="font-medium">{q}</span>
                <span className="mt-1 text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
