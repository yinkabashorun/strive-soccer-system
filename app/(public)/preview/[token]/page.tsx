import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Dumbbell, ShieldCheck } from "lucide-react";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { PLYO_PILLAR, PROGRESS_METRICS, type Drill } from "@/lib/elite/types";
import { DrillVideo } from "@/components/elite/DrillVideo";

// Read-only course preview for invited coaches (testimonials, partners).
// Token-gated link, no login, and ZERO player data - only the drill bank
// and how the program is structured. Rotate the token to revoke access.
const PREVIEW_TOKEN = process.env.COURSE_PREVIEW_TOKEN || "coach-x9k42m";

export const metadata: Metadata = {
  title: "Strive Elite · Coach Preview",
  description: "The Strive Elite training system, drill bank and structure.",
  robots: { index: false, follow: false },
};

const STRUCTURE: [string, string][] = [
  [
    "The same rhythm every week",
    "4 sessions, about 40 minutes each. Same structure every time, so a player just shows up and trains instead of wondering what today is. I look over every plan before it goes out.",
  ],
  [
    "Athleticism, not just touches",
    "Every session opens with two warm-up blocks built for power and speed. Nothing flashy, just the kind of work that adds up week over week.",
  ],
  [
    "Built around the kid, not the group",
    "The week is different for every player, based on what they're actually weak at. Left alone, a kid will practice what he's already good at. This doesn't let him.",
  ],
  [
    "A video for every drill",
    "So nobody's guessing what a rep should look like when I'm not standing there.",
  ],
  [
    "Wall days are their own thing",
    "If a kid's driving to a wall, the whole session happens there, and it does double duty for scanning habits too. No wall nearby, the program still works fine without one.",
  ],
  [
    "Parents actually know what's going on",
    "The app tracks what gets done, I send a weekly recap, and there's a live film session every week. Nothing slips by quietly.",
  ],
];

export default async function CoachPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (token !== PREVIEW_TOKEN) notFound();

  const admin = createServiceClient();
  if (!admin) notFound();
  const { data } = await admin
    .from("elite_drills")
    .select("*")
    .eq("active", true)
    .order("sort");
  const drills = (data ?? []) as Drill[];

  const pillars = [PLYO_PILLAR, ...PROGRESS_METRICS].filter((p) =>
    drills.some((d) => d.pillar === p)
  );

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
        <ShieldCheck className="h-3.5 w-3.5" /> Private link, just for you
      </div>
      <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">
        Strive Elite
      </h1>
      <p className="mt-3 max-w-xl text-white/60">
        This is the training system behind my app, how I build a
        player&apos;s week and what every drill actually looks like. No
        rush, look through it whenever you have a few minutes.
      </p>

      {/* How the course is structured - Coach Yinka's voice, quick read */}
      <section className="mt-8 space-y-3">
        {STRUCTURE.map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="font-display text-base font-semibold">
              {title}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/55">{body}</p>
          </div>
        ))}
      </section>

      {/* The drill bank */}
      <h2 className="mt-10 font-display text-xl font-bold">
        The drill bank
      </h2>
      <p className="mt-1 text-sm text-white/50">
        {drills.length} drills, every one filmed, and this is the only
        library I build weeks from.
      </p>

      {pillars.map((pillar) => {
        const list = drills.filter((d) => d.pillar === pillar);
        return (
          <section key={pillar} className="mt-7">
            <h3 className="mb-2.5 flex items-center gap-2 font-display text-lg font-bold">
              <Dumbbell className="h-4 w-4 text-accent" />
              {pillar === PLYO_PILLAR ? "Plyo warm-ups" : pillar}
              <span className="text-sm font-normal text-white/35">
                {list.length} {pillar === PLYO_PILLAR ? "warm-ups" : "drills"}
              </span>
            </h3>
            <div className="space-y-2">
              {list.map((d) => (
                <div key={d.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-bone">{d.title}</span>
                    {d.reps && <span className="chip">{d.reps}</span>}
                    <span className="chip">{d.minutes} min</span>
                    {d.needs_wall && (
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                        wall
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-snug text-white/55">{d.how}</p>
                  {d.cues && (
                    <p className="mt-1 text-xs text-white/40">Cues: {d.cues}</p>
                  )}
                  {d.video_url && <DrillVideo src={d.video_url} label="Watch demo" />}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-10 border-t border-white/8 pt-5 text-center text-xs text-white/35">
        Strive Soccer · thestriveapp.com · Just between us, hold onto the
        link.
      </p>
    </div>
  );
}
