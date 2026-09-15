import type { Metadata } from "next";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { PLYO_PILLAR, PROGRESS_METRICS, type Drill } from "@/lib/elite/types";
import { DrillVideo } from "@/components/elite/DrillVideo";
import { Wordmark } from "@/components/elite/Wordmark";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Strive Elite",
  description: "How the training system is structured.",
  openGraph: {
    title: "Strive Elite",
    description: "How the training system is structured.",
    type: "website",
  },
};

// Structure, not inventory. Short beats on how a week is built, then a
// small taste of the drill bank so it's not just a claim - never the whole
// library, that's the paid product. Pairs with the announcement: DM "APP".
const STRUCTURE: [string, string][] = [
  ["4 sessions a week", "Same rhythm every time. A player just shows up and trains."],
  ["Built around the kid", "Every week is different, based on what they're actually weak at."],
  ["Every drill on video", "Nobody's guessing what a rep should look like."],
  ["A weekly recap for you", "What got done, what's next. Nothing slips by quietly."],
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
      <p className="mt-2 text-sm text-white/45">How the training is structured.</p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {STRUCTURE.map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="font-display text-sm font-bold">{title}</div>
            <p className="mt-1 text-xs leading-relaxed text-white/50">{body}</p>
          </div>
        ))}
      </div>

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

      <div className="mt-9 rounded-2xl border border-accent/30 bg-accent/[0.06] p-5 text-center">
        <div className="font-display text-2xl font-black">
          $249<span className="text-base font-semibold text-white/60">/mo</span>
        </div>
        <p className="mt-1 text-sm text-white/60">
          Starting Oct 1. Join by Sept 30 and lock $199/mo for life.
        </p>
        <p className="mt-3 text-sm font-semibold text-accent">
          Comment or DM &ldquo;APP&rdquo;
        </p>
      </div>
    </div>
  );
}
