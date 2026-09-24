import type { Metadata } from "next";
import Script from "next/script";
import { createServiceClient } from "@/lib/elite/supabase/server";
import type { Drill } from "@/lib/elite/types";
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

// This page does the job a VSL usually does: hook, mechanism, proof,
// objections, offer, close. Structure over inventory - never the whole
// drill bank, that's the paid product. Close is the GHL intake form
// (matches the in-person path: form first, Carla reaches out to book the
// call), with DM "APP" as the fast lane for whoever's already warm from a
// post.
const STRUCTURE: [string, string][] = [
  ["4 sessions a week, built around you", "Same rhythm every time, layered on top of regular training. You show up, it's already planned, you just train."],
  ["Not built for the group. Built for you.", "Every week targets what YOU actually need work on, not what's convenient for 15 kids on one field."],
  ["Every drill, shown to you first", "No guessing what a rep should look like. Watch it, then go do it."],
  ["A weekly update, just for you", "What got done, what's next. Nothing slips by quietly, ever."],
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

  // Curated tiles, never the full bank. Each one is either a specific
  // named drill from the live bank (by title, so it still breaks loudly
  // if that drill ever gets renamed or deactivated) or a dedicated hosted
  // clip that isn't a bank entry at all.
  const byTitle = (title: string) => drills.find((d) => d.title === title)?.video_url;
  type Sample = { id: string; label: string; video_url: string };
  const CURATED: [string, string, string | undefined][] = [
    ["plyo", "Warm-ups", byTitle("Plyo warm-up: Pogo jumps")],
    ["ball-mastery", "Ball Mastery", "/drills/ball-mastery-juggle-catch.mp4"],
    ["passing", "Passing", byTitle("Two touch passing")],
    ["confidence", "Confidence", byTitle("Ronaldinho drill")],
    ["1v1", "1v1 Skills", "/drills/neymar-feint.mp4"],
  ];
  const sample: Sample[] = CURATED.filter(
    (row): row is [string, string, string] => Boolean(row[2])
  ).map(([id, label, video_url]) => ({ id, label, video_url }));

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
          <DrillVideo key={d.id} src={d.video_url} label={d.label} />
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
          $300<span className="text-base font-semibold text-white/60">/mo</span>
        </div>
        <p className="mt-1 text-sm text-white/60">
          Starting Nov 2. Join by Nov 1 and lock $199/mo for life.
        </p>
        <p className="mt-4 text-sm font-semibold text-white">
          Tell us about your player below. I&apos;ll personally reach out to
          get your call on the books.
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-white">
        <iframe
          src="https://api.leadconnectorhq.com/widget/survey/W14MZotX2vYkpyDPKOY8"
          style={{ border: "none", width: "100%", display: "block" }}
          scrolling="no"
          id="W14MZotX2vYkpyDPKOY8"
          title="Strive Elite intake"
          data-cookie-consent="true"
          data-cookie-consent-provider="auto"
          className="min-h-[720px]"
        />
      </div>
      <Script src="https://link.msgsndr.com/js/form_embed.js" strategy="afterInteractive" />

      <p className="mt-4 text-center text-xs text-white/40">
        or comment / DM &ldquo;APP&rdquo; on Instagram
      </p>
    </div>
  );
}
