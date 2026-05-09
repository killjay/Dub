import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";

type Plan = {
  id: string;
  name: string;
  price: number;
  blurb: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    blurb: "2 min/mo · 1 language · watermark intro 3 sec",
    features: [
      "2 minutes/month",
      "Pick any 1 language",
      '"Made with DubKaroo" intro tag',
      "Standard queue",
    ],
    cta: "Start free",
  },
  {
    id: "starter",
    name: "Starter",
    price: 999,
    blurb: "For creators just starting regional",
    features: [
      "30 minutes/month",
      "Any 3 of 6 languages",
      "No watermark",
      "Standard queue",
    ],
    cta: "Choose Starter",
  },
  {
    id: "creator",
    name: "Creator",
    price: 2499,
    highlighted: true,
    blurb: "Most popular for 100K+ sub channels",
    features: [
      "90 minutes/month",
      "All 6 languages",
      "Priority queue",
      "WhatsApp delivery + voice preset library",
    ],
    cta: "Choose Creator",
  },
  {
    id: "pro",
    name: "Pro",
    price: 4999,
    blurb: "Studios, MCNs, daily uploaders",
    features: [
      "240 minutes/month",
      "LatentSync premium lip-sync",
      "Batch upload",
      "1 voice clone slot (when v2 ships) · API waitlist",
    ],
    cta: "Choose Pro",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-border py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Pricing in rupees. UPI AutoPay. Zero MDR.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Spillover at ₹49/min per language. Cancel any time. Annual = 2 months free.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6",
                p.highlighted
                  ? "border-primary bg-background shadow-lg ring-1 ring-primary/30"
                  : "border-border bg-background"
              )}
            >
              {p.highlighted && (
                <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Most popular
                </div>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">
                  {p.price === 0 ? "Free" : formatINR(p.price)}
                </span>
                {p.price > 0 && <span className="text-sm text-muted-foreground">/mo</span>}
              </div>
              <ul className="mt-5 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a href="#waitlist" className="mt-6 block">
                <Button
                  className="w-full"
                  variant={p.highlighted ? "primary" : "outline"}
                  size="md"
                >
                  {p.cta}
                </Button>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
