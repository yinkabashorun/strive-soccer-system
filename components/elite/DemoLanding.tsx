import Link from "next/link";
import Script from "next/script";
import { createServiceClient } from "@/lib/elite/supabase/server";
import type { Drill } from "@/lib/elite/types";
import { DrillVideo } from "@/components/elite/DrillVideo";
import { Wordmark } from "@/components/elite/Wordmark";
import { Reveal, RevealWords } from "@/components/elite/Reveal";
import { VslPlayer } from "@/components/elite/VslPlayer";

// Set this to the unlisted YouTube video id once the VSL is uploaded. The
// player autoplays muted above the headline with a "Tap for sound" layer
// (components/elite/VslPlayer.tsx). Empty = no video section.
const VSL_YOUTUBE_ID = "QoYKWmCN5lM";
// The upload is a YouTube Short (9:16), so the player is portrait.
const VSL_PORTRAIT = true;

// This page does the job a VSL usually does: hook, mechanism, proof,
// objections, offer, close. Structure over inventory - never the whole
// drill bank, that's the paid product. Close is the GHL intake form
// (matches the in-person path: form first, Carla reaches out to book the
// call), with DM "ELITE" as the fast lane for whoever's already warm from
// a post. Every section builds itself in as it scrolls into view
// (components/elite/Reveal.tsx), the hero assembles on load.
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

function SectionTitle({ children, delay = 0 }: { children: string; delay?: number }) {
  return (
    <Reveal as="h2" delay={delay} className="mb-2.5 mt-9 font-display text-sm font-bold uppercase tracking-wider text-white/50">
      {children}
    </Reveal>
  );
}

export async function DemoLanding() {
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
      {/* Hero assembles on load: wordmark rises, a gold hairline draws under it,
          then the headline builds word by word. */}
      <div className="rise-in flex items-center justify-between gap-4">
        <Wordmark href={null} size="lg" />
        <Link
          href="/login"
          className="shrink-0 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/80 transition-colors hover:border-white/30 hover:text-white"
        >
          Member sign in
        </Link>
      </div>
      <div className="draw-line mt-3 h-px w-24 bg-accent/80" />

      {VSL_YOUTUBE_ID ? (
        <div className="rise-in mt-6" style={{ animationDelay: "250ms" }}>
          <VslPlayer videoId={VSL_YOUTUBE_ID} portrait={VSL_PORTRAIT} />
        </div>
      ) : null}

      {/* Hook - the real gap, no manufactured urgency, no stats we can't stand behind */}
      <h1 className="mt-5 font-display text-2xl font-bold leading-tight sm:text-3xl">
        <RevealWords
          text="Team training 3-4x a week is not close to enough to achieve your goals."
          accentIndexes={[6, 7, 8, 9]}
          startDelay={350}
        />
      </h1>
      <Reveal as="p" delay={120} className="mt-3 text-sm leading-relaxed text-white/55">
        Team practice is real work, but it&apos;s built for the whole group.
        Strive Elite is the individual layer on top: a weekly plan built
        around what your player specifically needs to reach the next level,
        not what fits 15 kids on one field.
      </Reveal>

      {/* Mechanism */}
      <SectionTitle>How it works</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {STRUCTURE.map(([title, body], i) => (
          <Reveal key={title} variant="build" delay={i * 90} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="font-display text-sm font-bold">{title}</div>
            <p className="mt-1 text-xs leading-relaxed text-white/50">{body}</p>
          </Reveal>
        ))}
      </div>

      {/* Proof - a taste, not the catalog */}
      <SectionTitle>A taste of it</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {sample.map((d, i) => (
          <Reveal key={d.id} variant="build" delay={i * 80}>
            <DrillVideo src={d.video_url} label={d.label} />
          </Reveal>
        ))}
      </div>
      <Reveal as="p" delay={160} className="mt-2.5 text-xs text-white/35">
        Every drill in the plan looks like this. The full bank is what your
        player actually trains from.
      </Reveal>

      {/* Objections */}
      <SectionTitle>Fair questions</SectionTitle>
      <div className="space-y-2">
        {OBJECTIONS.map(([q, a], i) => (
          <Reveal key={q} variant="build" delay={i * 100} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="font-display text-sm font-bold">{q}</div>
            <p className="mt-1 text-xs leading-relaxed text-white/50">{a}</p>
          </Reveal>
        ))}
      </div>

      {/* Offer + close */}
      <Reveal variant="build" className="mt-9 rounded-2xl border border-accent/30 bg-accent/[0.06] p-5 text-center">
        <div className="font-display text-2xl font-black">
          $350<span className="text-base font-semibold text-white/60">/mo</span>
        </div>
        <Reveal variant="line" delay={250} className="mx-auto mt-2 h-px w-16 bg-accent/70" />
        <Reveal as="p" delay={300} className="mt-2 text-sm text-white/60">
          Starting Nov 2. Join by Nov 1 and lock $249/mo for life.
        </Reveal>
        <Reveal as="p" delay={420} className="mt-4 text-sm font-semibold text-white">
          Tell us about your player below. I&apos;ll personally reach out to
          get your call on the books.
        </Reveal>
      </Reveal>

      <Reveal delay={120} className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-white">
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
      </Reveal>
      <Script src="https://link.msgsndr.com/js/form_embed.js" strategy="afterInteractive" />

      <Reveal as="p" delay={200} className="mt-4 text-center text-xs text-white/40">
        or comment / DM &ldquo;ELITE&rdquo; on Instagram
      </Reveal>
      <Reveal as="p" delay={260} className="mt-8 text-center text-xs text-white/35">
        Already a member?{" "}
        <Link href="/login" className="text-white/70 underline underline-offset-4 hover:text-white">
          Sign in to your dashboard
        </Link>
      </Reveal>
    </div>
  );
}
