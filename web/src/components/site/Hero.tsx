import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(230,57,70,0.12),transparent_70%)]" />
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center animate-fade-up">
          <Badge className="mb-5">Built for Hindi creators going regional</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Dub your reel into <span className="gradient-text">6 Indian languages</span> in 10 minutes.
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted-foreground sm:text-xl">
            Upload Hindi or English. Get Tamil, Telugu, Marathi, Bengali, Kannada, and Bhojpuri —
            natural voices, lip-synced, ready to publish.
            <span className="block pt-1">No studios. No ₹3K/min. Just upload and ship.</span>
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#waitlist">
              <Button size="lg">Join the waitlist — get 30 free min</Button>
            </a>
            <Link href="#languages" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              See a sample dub →
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            ₹1,499/mo gets you 90 minutes across all 6 languages. UPI AutoPay. Cancel anytime.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "60%+", sub: "of YT India watch time is regional" },
            { label: "20×", sub: "cheaper than dubbing studios" },
            { label: "<8 min", sub: "wall-clock per minute of video" },
            { label: "6", sub: "Indian languages, day one" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-muted/40 p-4 text-center">
              <div className="text-2xl font-semibold">{s.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
