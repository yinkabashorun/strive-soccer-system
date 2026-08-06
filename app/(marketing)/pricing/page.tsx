import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Reveal } from "@/components/elite/Reveal";
import { CheckoutButton } from "@/components/elite/CheckoutButton";

export const metadata: Metadata = {
  title: "Pricing · Strive Elite",
  description:
    "Simple, premium pricing for the Strive Elite development program. Monthly membership or a one-time session.",
};

const PLANS = [
  {
    id: "session" as const,
    name: "Single Session",
    price: "$75",
    cadence: "one-time",
    tagline: "Try the system with one focused session.",
    cta: "Book a session",
    variant: "outline" as const,
    features: [
      "One 1-on-1 coaching session",
      "Personalized session notes",
      "One week of homework",
      "Parent update after the session",
    ],
  },
  {
    id: "monthly" as const,
    name: "Elite Membership",
    price: "$199",
    cadence: "/ month",
    tagline: "The full development system, every week.",
    cta: "Start membership",
    variant: "accent" as const,
    featured: true,
    features: [
      "Weekly 1-on-1 coaching",
      "Weekly homework + film review",
      "Progress tracking across 7 pillars",
      "AI-generated weekly plans",
      "Parent reports after every session",
      "Direct coach messaging",
      "Achievements + accountability",
    ],
  },
  {
    id: "elite" as const,
    name: "Academy Track",
    price: "$399",
    cadence: "/ month",
    tagline: "For players chasing the next level.",
    cta: "Apply now",
    variant: "outline" as const,
    features: [
      "Everything in Elite Membership",
      "Two sessions per week",
      "Priority film analysis",
      "College / academy pathway support",
      "Monthly performance review call",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-32">
      <Reveal>
        <div className="text-center">
          <div className="eyebrow mb-4">Membership</div>
          <h1 className="display mx-auto max-w-3xl text-balance text-[clamp(2.5rem,7vw,5rem)]">
            One program. Total development.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/55">
            Cancel anytime. No contracts. Just the most complete youth
            development system in the DMV.
          </p>
        </div>
      </Reveal>

      <div className="mt-16 grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan, i) => (
          <Reveal key={plan.id} delay={i * 80}>
            <div
              className={
                "relative flex h-full flex-col rounded-4xl border p-7 " +
                (plan.featured
                  ? "border-accent/30 bg-accent/[0.05] shadow-glow"
                  : "border-white/8 bg-white/[0.02]")
              }
            >
              {plan.featured && (
                <div className="absolute -top-3 left-7 chip-accent">
                  Most popular
                </div>
              )}
              <div className="font-display text-2xl font-bold uppercase tracking-tight">
                {plan.name}
              </div>
              <p className="mt-1.5 text-sm text-white/50">{plan.tagline}</p>
              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="font-display text-5xl font-black">
                  {plan.price}
                </span>
                <span className="text-sm text-white/45">{plan.cadence}</span>
              </div>

              <ul className="mt-7 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check
                      className={
                        "mt-0.5 h-4 w-4 shrink-0 " +
                        (plan.featured ? "text-accent" : "text-white/50")
                      }
                    />
                    <span className="text-white/70">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 pt-2">
                <CheckoutButton
                  plan={plan.id}
                  label={plan.cta}
                  variant={plan.variant}
                />
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <p className="mt-12 text-center text-sm text-white/40">
          Not sure which fits?{" "}
          <Link href="/contact" className="text-accent hover:underline">
            Talk to a coach
          </Link>{" "}
          — we&apos;ll help you choose.
        </p>
      </Reveal>
    </div>
  );
}
