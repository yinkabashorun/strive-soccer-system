import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Play,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PostPurchaseTagger } from "@/components/PostPurchaseTagger";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "You're in · Strive Dribbling System",
  description:
    "Welcome to the Strive Dribbling System. Day 1 instructions are on the way.",
};

export default function DribblingCourseSuccessPage({
  searchParams,
}: {
  searchParams?: { session_id?: string };
}) {
  const sessionId = searchParams?.session_id ?? null;

  return (
    <>
      <header className="border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Logo />
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -left-32 -bottom-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mx-auto max-w-2xl px-5 py-20 text-center md:py-28">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-accent/40 bg-accent/15 text-accent">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="mt-6 inline-flex chip-accent">Payment confirmed</div>
          <h1 className="h-display mt-4 text-3xl font-semibold leading-tight md:text-5xl">
            You're in. Let's build something real.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-bone/85 md:text-lg">
            Check your email — your course access is on its way. The
            <span className="text-accent"> Day 1 </span>
            walkthrough is waiting inside.
          </p>

          {/* What happens next */}
          <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Step
              n={1}
              icon={<Mail className="h-4 w-4" />}
              title="Watch your inbox"
              body="Receipt + access link land within a few minutes. Whitelist coach@strivesoccer.com if it goes to spam."
            />
            <Step
              n={2}
              icon={<Play className="h-4 w-4" />}
              title="Start Module 1"
              body="Ball Mastery Foundation. 30 minutes. A ball and a flat surface — that's it."
            />
            <Step
              n={3}
              icon={<ArrowRight className="h-4 w-4" />}
              title="Stack the days"
              body="3-5 sessions a week. By the second week, the touch starts to feel different."
            />
          </div>

          {/* Start-here CTA */}
          <div className="mt-12 rounded-2xl border border-accent/30 bg-accent/[0.06] p-6 text-left md:p-8">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Your Day 1 starts now
            </div>
            <h3 className="h-display mt-2 text-2xl font-semibold leading-snug">
              Block 30 minutes today.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-bone/85 md:text-base">
              The fastest path to results: open the access email, hit play on
              Module 1, and run the warmup tonight. Same time, same place,
              tomorrow. By the end of Week 2, the difference is unmistakable.
            </p>
            <a
              href="mailto:coach@strivesoccer.com?subject=Strive%20Dribbling%20System%20%E2%80%93%20Day%201"
              className="btn-accent mt-5 inline-flex"
            >
              <Mail className="h-4 w-4" />
              Ping the coach if anything's missing
            </a>
          </div>

          {sessionId && (
            <div className="mt-6 text-[10px] uppercase tracking-[0.2em] text-muted">
              Order ref · {sessionId.slice(-12)}
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
            <ShieldCheck className="h-3.5 w-3.5" />
            14-day refund · no questions
          </div>

          <Link
            href="/dribbling-course"
            className="mt-10 inline-flex items-center gap-1.5 text-xs text-muted hover:text-bone"
          >
            <ArrowRight className="h-3 w-3" />
            Back to the course page
          </Link>

          {/* Fires the GHL tag + Supabase course_sales insert in the
              background. Invisible to the buyer when it succeeds; only
              renders an error banner when it doesn't. */}
          <PostPurchaseTagger sessionId={sessionId} />
        </div>
      </section>
    </>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-ink-200/40 p-5 text-left">
      <div className="flex items-center gap-2">
        <div className="grid h-6 w-6 place-items-center rounded-full bg-accent text-[11px] font-bold text-black">
          {n}
        </div>
        <span className="text-accent">{icon}</span>
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
    </div>
  );
}
