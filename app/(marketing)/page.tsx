import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Clipboard,
  Film,
  MessageSquare,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { Reveal } from "@/components/elite/Reveal";
import { ProgressRing } from "@/components/elite/ProgressRing";
import { ProgressBar } from "@/components/elite/ProgressBar";

const HERO_VIDEO =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/sFEFJGBMjjNvjFPO.mp4";

export default function LandingPage() {
  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster=""
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
        <div className="absolute inset-0 bg-radial-spot" />

        <div className="relative mx-auto w-full max-w-6xl px-5 pt-28 pb-20">
          <Reveal>
            <div className="chip-accent mb-6 inline-flex">
              <Sparkles className="h-3.5 w-3.5" /> Strive Soccer FC · Elite Program
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="display max-w-4xl text-balance text-[clamp(2.75rem,9vw,6.5rem)]">
              Not private sessions.
              <br />
              <span className="text-accent">A development system.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
              Personalized coaching, weekly homework, progress tracking, film
              analysis, and real accountability — for serious young players.
              Everything your child needs to develop, in one premium app.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="btn-accent w-full px-6 py-3.5 text-base sm:w-auto"
              >
                Start the program <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="btn w-full px-6 py-3.5 text-base sm:w-auto"
              >
                See pricing
              </Link>
            </div>
          </Reveal>

          <Reveal delay={340}>
            <dl className="mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/8 pt-8">
              {[
                ["7", "Development pillars tracked"],
                ["100%", "Homework accountability"],
                ["24/7", "Coach in your pocket"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="font-display text-4xl font-black text-bone sm:text-5xl">
                    {n}
                  </dt>
                  <dd className="mt-1 text-xs leading-snug text-white/45">{l}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------- Value / positioning */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
        <Reveal>
          <div className="eyebrow mb-4">Why parents choose Strive Elite</div>
          <h2 className="display max-w-3xl text-balance text-[clamp(2rem,5vw,3.5rem)]">
            A private trainer gives you an hour. We give you the whole week.
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/55">
            Most training ends when the session does. Strive Elite turns every
            session into a structured plan — homework, film to study, measurable
            goals, and a coach who holds your player accountable between sessions.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <FeatureCard {...f} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- Dashboard preview */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-24 lg:grid-cols-2">
          <Reveal>
            <div>
              <div className="eyebrow mb-4">The player experience</div>
              <h2 className="display text-balance text-[clamp(1.9rem,4.5vw,3rem)]">
                Every morning, they know exactly what to work on.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-white/55">
                Today&apos;s focus. This week&apos;s homework. Progress that
                updates as they train. It feels less like a chore and more like
                a game they want to win.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  "Today's focus, front and center",
                  "Tap to complete homework — progress moves live",
                  "Achievements that keep them coming back",
                  "A message from their coach, always",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <span className="text-white/70">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <DashboardPreview />
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------- How it works */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
        <Reveal>
          <div className="eyebrow mb-4">How it works</div>
          <h2 className="display max-w-2xl text-balance text-[clamp(2rem,5vw,3.25rem)]">
            Three steps to a complete development system.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 80}>
              <div className="elite-card h-full p-7">
                <div className="font-display text-5xl font-black text-accent">
                  0{i + 1}
                </div>
                <h3 className="mt-4 font-display text-2xl font-bold uppercase tracking-tight">
                  {s.title}
                </h3>
                <p className="mt-3 leading-relaxed text-white/55">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- CTA banner */}
      <section className="mx-auto max-w-6xl px-5 pb-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-4xl border border-accent/20 bg-gradient-to-br from-accent/[0.08] via-white/[0.02] to-transparent p-10 sm:p-16">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative">
              <h2 className="display max-w-2xl text-balance text-[clamp(2rem,5vw,3.5rem)]">
                Give your player a reason to train every day.
              </h2>
              <p className="mt-5 max-w-xl text-lg text-white/60">
                Join the Strive Elite program. First week, they&apos;ll feel the
                difference. First month, everyone will.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="btn-accent w-full px-6 py-3.5 text-base sm:w-auto"
                >
                  Get started <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="btn w-full px-6 py-3.5 text-base sm:w-auto"
                >
                  Talk to a coach
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

const FEATURES = [
  {
    icon: Clipboard,
    title: "Weekly Homework",
    body: "Exercises, reps, and video — assigned by the coach, completed by the player, tracked automatically.",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    body: "Seven pillars, from ball mastery to decision making, scored and trended over time.",
  },
  {
    icon: Film,
    title: "Film Analysis",
    body: "Upload game footage. Get coach notes tied to the moments that matter.",
  },
  {
    icon: Brain,
    title: "AI Session Notes",
    body: "Coaches type in plain English. The plan, homework, and parent update write themselves.",
  },
  {
    icon: MessageSquare,
    title: "Parent Updates",
    body: "Every session generates a clear summary of progress and what's next — ready to read.",
  },
  {
    icon: Target,
    title: "Accountability",
    body: "Goals, streaks, and a coach who checks in. Development that doesn't stop at the whistle.",
  },
];

const STEPS = [
  {
    title: "Assess",
    body: "Your player is scored across seven development pillars, with clear goals set by their coach.",
  },
  {
    title: "Train",
    body: "Weekly homework, film to study, and a today's-focus that makes every day count.",
  },
  {
    title: "Track",
    body: "Progress updates as they train. Parents get a full report after every session.",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Target;
  title: string;
  body: string;
}) {
  return (
    <div className="elite-card group h-full p-6 transition-colors hover:border-white/12 hover:bg-white/[0.03]">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
        <Icon className="h-[22px] w-[22px]" />
      </div>
      <h3 className="mt-5 font-display text-xl font-bold uppercase tracking-tight">
        {title}
      </h3>
      <p className="mt-2.5 text-sm leading-relaxed text-white/55">{body}</p>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-4xl bg-accent/10 blur-3xl" />
      <div className="relative rounded-4xl border border-white/10 bg-ink-100 p-5 shadow-lift sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
              Week 7 · Advanced
            </div>
            <div className="font-display text-2xl font-black">
              Good morning, Marcus
            </div>
          </div>
          <ProgressRing value={72} size={72} stroke={7} sublabel="Week" />
        </div>

        <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/[0.06] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Today&apos;s focus
          </div>
          <div className="mt-1 font-medium text-bone">
            Scan before you receive — two looks minimum
          </div>
        </div>

        <div className="mt-4 space-y-3.5">
          <ProgressBar label="Ball Mastery" value={82} prev={74} />
          <ProgressBar label="Scanning" value={71} prev={58} />
          <ProgressBar label="Confidence" value={80} prev={70} />
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
            <Trophy className="h-[18px] w-[18px]" />
          </div>
          <div className="text-sm">
            <span className="font-semibold text-bone">Homework Hero</span>
            <span className="text-white/45"> · 100% three weeks running</span>
          </div>
        </div>
      </div>
    </div>
  );
}
