import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, PlayCircle, BookOpen, Plus } from "lucide-react";
import { Wordmark } from "@/components/elite/Wordmark";
import { isStripeConfigured } from "@/lib/stripe";
import { PAYMENTS_OFF_MESSAGE, PRO_JOIN, PRO_PRICE_LINE, priceLabel } from "@/lib/elite/pro";

export const metadata: Metadata = {
  title: "Strive Pro",
  description: `A new week of training every Monday, built around your game. ${PRO_PRICE_LINE}, cancel anytime.`,
};

export const dynamic = "force-dynamic";

// The Strive Pro page (074): what Pro is, the price, and one button. It
// reads right to a high school player or to a parent signing up their
// player. No promise of results, no countdown, no number that is not true: the
// price is the one constant in lib/elite/pro.ts.
const WHAT_YOU_GET = [
  {
    icon: CalendarCheck,
    title: "A new week every Monday",
    body: "Built around your quiz answers, the drills you finish and the check-in you send at the end of each week.",
  },
  {
    icon: PlayCircle,
    title: "Every drill on video",
    body: "Watch it, then do it. The set timer counts your sets and your rest, so all you do is train.",
  },
  {
    icon: BookOpen,
    title: "The courses library",
    body: "Weak foot, strength, speed, juggling, recruiting and more. Open any of them, any time.",
  },
  {
    icon: Plus,
    title: "Extra work when you want it",
    body: "Done with the week and want more? Add an extra session from the drills you have not done yet.",
  },
];

const STEPS = [
  { n: "01", title: "Create your account", body: "Your name, email, phone and a password. One minute." },
  { n: "02", title: "Start your membership", body: `${PRO_PRICE_LINE} by card. Cancel anytime from Account.` },
  {
    n: "03",
    title: "Answer the quiz",
    body: "Your position, your goals, your weak spots and where you train. Monday to Saturday your first week is ready within the hour. On a Sunday it is ready Monday morning.",
  },
];

export default function ProPage() {
  const payments = isStripeConfigured();
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center justify-between">
        <Wordmark href={null} />
        <Link href="/login" className="tap text-sm font-semibold text-white/70 hover:text-white">
          Sign in
        </Link>
      </header>

      <section className="mt-10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Strive Pro</div>
        <h1 className="mt-3 font-display text-[40px] font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          A new week of training every Monday, built around your game.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-white/70">
          Tell us where your game is and what you want from it. Every week of sessions is built
          around your answers and around how your last week went, so the work you put in on your
          own goes after the parts of your game that need it.
        </p>
      </section>

      <section aria-label="What you get" className="mt-10 space-y-3">
        {WHAT_YOU_GET.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-4 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
            <Icon className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
            <div>
              <h2 className="font-display text-xl font-black uppercase leading-tight">{title}</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-white/65">{body}</p>
            </div>
          </div>
        ))}
      </section>

      <section aria-label="How it starts" className="mt-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">How it starts</h2>
        <ol className="mt-3 space-y-4">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="font-display text-2xl font-black leading-none text-accent">{s.n}</span>
              <div>
                <div className="text-[16px] font-semibold text-bone">{s.title}</div>
                <p className="mt-0.5 text-[15px] leading-relaxed text-white/60">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Price" className="mt-10 rounded-3xl border border-accent/30 bg-accent/[0.05] p-6 text-center">
        <div className="font-display text-6xl font-black leading-none">{priceLabel()}</div>
        <div className="mt-1 text-[15px] font-semibold uppercase tracking-[0.14em] text-white/70">a month</div>
        <p className="mt-3 text-[15px] text-white/65">Cancel anytime from Account.</p>
        {payments ? (
          <Link
            href={PRO_JOIN}
            className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black"
          >
            Start Pro
          </Link>
        ) : (
          <p role="status" className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4 text-[15px] text-white/75">
            {PAYMENTS_OFF_MESSAGE}
          </p>
        )}
      </section>

      <p className="mt-8 text-center text-[14px] leading-relaxed text-white/55">
        Signing up for your player? Use your own email and phone. If your player is under 13, a
        parent or guardian creates the account.
      </p>
      <p className="mt-3 text-center text-[14px] text-white/55">
        Already have an account?{" "}
        <Link href="/login" className="tap font-semibold text-accent hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-6 text-center text-[13px] text-white/55">
        <Link href="/terms" className="tap hover:text-white">
          Terms
        </Link>
        {" · "}
        <Link href="/privacy" className="tap hover:text-white">
          Privacy
        </Link>
        {" · "}
        <Link href="/support" className="tap hover:text-white">
          Support
        </Link>
      </p>
    </div>
  );
}
