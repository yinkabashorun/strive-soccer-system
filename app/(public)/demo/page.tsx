import type { Metadata } from "next";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { PLYO_PILLAR, PROGRESS_METRICS, type Drill } from "@/lib/elite/types";
import { DrillVideo } from "@/components/elite/DrillVideo";
import { Wordmark } from "@/components/elite/Wordmark";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Strive Elite",
  description: "Training a lot doesn't help if it's never the thing your player actually needs.",
  openGraph: {
    title: "Strive Elite",
    description: "Training a lot doesn't help if it's never the thing your player actually needs.",
    type: "website",
  },
};

const BOOKING_URL = "https://calendly.com/strivesoccer100x/strive-elite-walkthrough-call";

// This page does the job a VSL usually does: hook, mechanism, proof,
// objections, offer, close. Structure over inventory - never the whole
// drill bank, that's the paid product. Two ways to close: book the call,
// or DM "APP" on Instagram for whoever's already warm from a post.
const STRUCTURE: [string, string][] = [
  ["4 sessions a week, on their own", "Layered on top of regular training. Same rhythm every time, a player just shows up and works."],
  ["Built around the kid", "Every week targets what they're actually weak at, not what's convenient for 15 kids on one field."],
  ["Every drill on video", "Nobody's guessing what a rep should look like."],
  ["A weekly recap for you", "What got done, what's next. Nothing slips by quietly."],
];

const OBJECTIONS: [string, string][] = [
  ["Will they actually do it?", "You get a recap every week. If it's not happening, you'll know immediately, not at the end of the season."],
  ["We already train 3-4 times a week.", "Group training is real work, but it can't target one kid's specific gap with a full team on the field. This is the individual layer on top, built around exactly what your player needs to reach the next level."],
  ["What if we miss a week?", "The plan picks back up the moment you're ready. No makeup schedule to manage, no falling behind."],
];

export default async function DemoPage() {
  const admin = createServiceClient();
  const { data } = admin
    ? await admin.from("elite_drills").select("*").eq("active", true).order("sort")
    : { data: null };
  const drills = (data ?? []) as Drill[];

  const pillars = [PLYO_PILLAR, ...PROGRESS_METRICS].filter((p) =>
    drills.some((d) => d.pillar === p)
  );
  // One example per pillar, never the full bank.
  const sample = pillars
    .map((p) => drills.find((d) => d.pillar === p && d.video_url))
    .filter((d): d is Drill => Boolean(d));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Wordmark href={null} size="lg" />

      {/* Hook - the real gap, no manufactured urgency, no stats we can't stand behind */}
      <h1 className="mt-5 font-display text-2xl font-bold leading-tight sm:text-3xl">
        Training three or four times a week
        <span className="text-accent"> doesn&apos;t help much</span> if
        it&apos;s never the thing your player actually needs work on.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        Team practice is real work, but it&apos;s built for the whole group.
        Strive Elite is the individual layer on top: a weekly plan built
        around what your player specifically needs to reach the next level,
        not what fits 15 kids on one field.
      </p>

      {/* Mechanism */}
      <h2 className="mb-2.5 mt-9 font-display text-sm font-bold uppercase tracking-wider text-white/50">
        How it works
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {STRUCTURE.map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="font-display text-sm font-bold">{title}</div>
            <p className="mt-1 text-xs leading-relaxed text-white/50">{body}</p>
          </div>
        ))}
      </div>

      {/* Proof - a taste, not the catalog */}
      <h2 className="mb-2.5 mt-9 font-display text-sm font-bold uppercase tracking-wider text-white/50">
        A taste of it
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {sample.map((d) => (
          <DrillVideo key={d.id} src={d.video_url!} label={d.pillar} />
        ))}
      </div>
      <p className="mt-2.5 text-xs text-white/35">
        Every drill in the plan looks like this. The full bank is what your
        player actually trains from.
      </p>

      {/* Objections */}
      <h2 className="mb-2.5 mt-9 font-display text-sm font-bold uppercase tracking-wider text-white/50">
        Fair questions
      </h2>
      <div className="space-y-2">
        {OBJECTIONS.map(([q, a]) => (
          <div key={q} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="font-display text-sm font-bold">{q}</div>
            <p className="mt-1 text-xs leading-relaxed text-white/50">{a}</p>
          </div>
        ))}
      </div>

      {/* Offer + close */}
      <div className="mt-9 rounded-2xl border border-accent/30 bg-accent/[0.06] p-5 text-center">
        <div className="font-display text-2xl font-black">
          $249<span className="text-base font-semibold text-white/60">/mo</span>
        </div>
        <p className="mt-1 text-sm text-white/60">
          Starting Oct 1. Join by Sept 30 and lock $199/mo for life.
        </p>
        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-accent mt-4 w-full justify-center px-4 py-3 text-sm sm:w-auto sm:px-8"
        >
          Book a 15-min call
        </a>
        <p className="mt-3 text-xs text-white/40">
          or comment / DM &ldquo;APP&rdquo; on Instagram
        </p>
      </div>
    </div>
  );
}
