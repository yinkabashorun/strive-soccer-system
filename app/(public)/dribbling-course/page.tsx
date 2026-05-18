import Link from "next/link";
import {
  Check,
  Clock,
  Flame,
  Lock,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { DribblingCheckoutButton } from "@/components/DribblingCheckoutButton";
import {
  COURSE_MODULES,
  FAQS,
  SOCIAL_PROOF_QUOTES,
} from "@/lib/course-ads-data";

export const metadata = {
  title: "Strive Dribbling System · $97 · Master the Ball. Slow the Game Down.",
  description:
    "A 4-module online ball mastery course for youth soccer players ages 9-18. 30 minutes a day, lifetime access, 14-day refund.",
};

// Module icons rotate so each card feels distinct without needing custom art
const MODULE_ICONS = [Sparkles, Zap, Target, TrendingUp] as const;

export default function DribblingCoursePage() {
  return (
    <>
      {/* TOP NAV */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 md:py-4">
          <Logo />
          <a
            href="#offer"
            className="btn-accent text-xs md:text-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Get Instant Access — $97
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-radial-spot" />
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="relative mx-auto max-w-4xl px-5 py-14 md:py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 chip-accent">
              <Flame className="h-3 w-3" />
              For soccer players 9-18 and the parents who back them
            </div>
            <h1 className="h-display mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.04] sm:text-5xl md:text-[56px]">
              Master the Ball. Slow the Game Down.{" "}
              <span className="text-accent">Play Without Fear.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-bone/85 md:text-lg">
              The Strive Dribbling System is a 4-module online course that
              builds real ball mastery and 1v1 confidence in youth soccer
              players ages 9-18 — in 30 minutes a day, from anywhere, for{" "}
              <span className="text-bone">$97</span>.
            </p>
            <div className="mt-8 flex flex-col items-center gap-2">
              <DribblingCheckoutButton size="lg" />
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                14-day money-back guarantee · One-time payment · Lifetime access
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF TICKER */}
      <section
        aria-label="What parents are saying"
        className="overflow-hidden border-b border-white/5 bg-ink-100/40"
      >
        <div className="relative flex overflow-hidden whitespace-nowrap py-4">
          <div className="flex animate-marquee items-center gap-12 pr-12 text-sm text-bone/80">
            {[...SOCIAL_PROOF_QUOTES, ...SOCIAL_PROOF_QUOTES].map((q, i) => (
              <span key={i} className="inline-flex items-center gap-3">
                <span className="text-accent">★</span>
                <span className="italic">"{q}"</span>
              </span>
            ))}
          </div>
          <div
            aria-hidden
            className="absolute top-0 flex animate-marquee items-center gap-12 pr-12 text-sm text-bone/80"
            style={{ left: "100%" }}
          >
            {[...SOCIAL_PROOF_QUOTES, ...SOCIAL_PROOF_QUOTES].map((q, i) => (
              <span key={`b-${i}`} className="inline-flex items-center gap-3">
                <span className="text-accent">★</span>
                <span className="italic">"{q}"</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-b border-white/5 py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-5">
          <div className="chip">The problem</div>
          <h2 className="h-display mt-3 text-3xl font-semibold leading-tight md:text-5xl">
            Why hard-working players still look the same in games.
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-bone/85 md:text-lg">
            <p>
              Most youth players train consistently and still freeze under
              pressure, rush their touches, and give the ball away the moment a
              defender closes them down. It's not effort. It's not talent.
            </p>
            <p>
              It's the type of training. Traditional drills build pattern
              recognition in controlled environments. Real soccer is chaos.
            </p>
            <p className="border-l-2 border-accent/60 pl-4 italic text-accent">
              Ball mastery is built through creative, pressure-simulated
              repetition that teaches the body to respond automatically — so
              that when the game gets fast, the player gets calm.
            </p>
          </div>
        </div>
      </section>

      {/* TRANSFORMATION */}
      <section className="relative overflow-hidden border-b border-white/5 py-16 md:py-24">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-5">
          <div className="chip-accent">The transformation</div>
          <h2 className="h-display mt-3 text-3xl font-semibold leading-tight md:text-5xl">
            What happens when a player has real mastery.
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <TransformItem
              before="Watches the ball"
              after="Reads the game"
            />
            <TransformItem
              before="Gives it away"
              after="Creates moments"
            />
            <TransformItem
              before="Plays not to mess up"
              after="Plays to dominate"
            />
            <TransformItem before="Hesitates 1v1" after="Defenders hesitate" />
          </div>
          <p className="mt-8 text-base leading-relaxed text-bone/85 md:text-lg">
            The confidence is real. A kid who trusts their feet carries
            themselves differently — on the pitch and off it.
          </p>
        </div>
      </section>

      {/* MODULES */}
      <section className="border-b border-white/5 py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-5">
          <div className="chip">Inside the course</div>
          <h2 className="h-display mt-3 text-3xl font-semibold leading-tight md:text-5xl">
            4 modules. One complete system.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {COURSE_MODULES.map((m, i) => {
              const Icon = MODULE_ICONS[i % MODULE_ICONS.length];
              return (
                <article
                  key={m.number}
                  className="card relative overflow-hidden p-6"
                >
                  <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/5 blur-3xl" />
                  <div className="relative">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-[11px] font-bold text-accent">
                        {String(m.number).padStart(2, "0")}
                      </span>
                      <Icon className="h-4 w-4 text-accent" />
                      <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
                        Module {m.number}
                      </span>
                    </div>
                    <h3 className="h-display mt-4 text-xl font-semibold">
                      {m.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-bone/85">
                      {m.description}
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted">
                      <Clock className="h-3 w-3" />
                      {m.duration}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* OFFER STACK */}
      <section
        id="offer"
        className="relative overflow-hidden border-b border-white/5 py-16 md:py-24"
      >
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-5">
          <div className="text-center">
            <div className="inline-flex chip-accent">The offer</div>
            <h2 className="h-display mt-3 text-3xl font-semibold leading-tight md:text-5xl">
              Everything you get for $97.
            </h2>
          </div>

          <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-white/10 bg-gradient-to-br from-ink-100 to-ink-200 p-6 md:p-10 shadow-card">
            <ul className="space-y-3">
              {[
                "Complete Strive Dribbling System · 4 Modules",
                "Module 1 · Ball Mastery Foundation sessions",
                "Module 2 · 1v1 Domination drills",
                "Module 3 · Pressure Training simulations",
                "Module 4 · Creative Play Unlocked sessions",
                "Lifetime access · train at your own pace",
                "Built for ages 9-18, every level",
                "Solo training — no special equipment, no team needed",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/30 p-3"
                >
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-sm text-bone/90 md:text-base">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-2xl border border-accent/30 bg-accent/[0.06] p-6 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                One-time payment
              </div>
              <div className="mt-2 h-display text-5xl font-semibold md:text-6xl">
                $97
              </div>
              <div className="mt-1 text-xs text-muted">
                No subscription. No upsell traps. Lifetime access.
              </div>
              <div className="mt-6 flex flex-col items-center gap-2">
                <DribblingCheckoutButton size="lg" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* URGENCY */}
      <section className="border-b border-white/5 py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-5">
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-6 md:flex-row md:items-center">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-300">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                Founding price
              </div>
              <h3 className="h-display mt-1 text-xl font-semibold">
                $97 is the lowest this will ever be.
              </h3>
              <p className="mt-1 text-sm text-bone/80">
                When the advanced module and the pressure-training expansion
                drop, the price goes up. Lock it in now.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* GUARANTEE */}
      <section className="border-b border-white/5 py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-5">
          <div className="chip">Guarantee</div>
          <h2 className="h-display mt-3 text-3xl font-semibold leading-tight md:text-5xl">
            14-Day Money-Back Guarantee.
          </h2>
          <div className="mt-6 flex items-start gap-4 rounded-2xl border border-accent/20 bg-accent/[0.04] p-6">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="text-base leading-relaxed text-bone/90 md:text-lg">
              Run the course for 14 days. If your player isn't visibly more
              comfortable on the ball — calmer under pressure, sharper first
              touch, real confidence — email me and you get every dollar back.
              No friction, no fine print. The risk is entirely on us.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-white/5 py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-5">
          <div className="chip">FAQ</div>
          <h2 className="h-display mt-3 text-3xl font-semibold leading-tight md:text-5xl">
            The questions other parents ask.
          </h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((f, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-white/5 bg-ink-200/40 p-5 open:bg-ink-200/60"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-3 text-sm font-semibold md:text-base">
                  {f.q}
                  <span className="text-accent transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-bone/85 md:text-base">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="h-display text-3xl font-semibold leading-tight md:text-5xl">
            Your player is one decision away from a different relationship with
            the ball.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-bone/80 md:text-lg">
            30 minutes a day. 14-day refund. $97, lifetime access.
          </p>
          <div className="mt-8 flex flex-col items-center gap-2">
            <DribblingCheckoutButton size="lg" />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 text-center text-[11px] text-muted">
          <Lock className="h-3 w-3" />
          <div>
            © Strive Soccer · Strive Dribbling System · Secure checkout via
            Stripe
          </div>
          <Link href="mailto:coach@strivesoccer.com" className="hover:text-bone">
            coach@strivesoccer.com
          </Link>
        </div>
      </footer>
    </>
  );
}

function TransformItem({ before, after }: { before: string; after: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-ink-200/40 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        Before · After
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="text-muted line-through">{before}</span>
        <span className="text-accent">→</span>
        <span className="font-semibold text-bone">{after}</span>
      </div>
    </div>
  );
}
