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
    "Real structure, every single week",
    "4 sessions, about 40 minutes each, same rhythm every week. Players stop wondering what to train and just train. I sign off on every plan before it goes out.",
  ],
  [
    "Plyos open every session",
    "Two explosive blocks before the ball work, so players build athleticism every session and it compounds over months, not left to chance.",
  ],
  [
    "Drills picked for the player, not the group",
    "Every week is built around that specific kid's weaknesses. Players naturally avoid what they're bad at. This program does not let them.",
  ],
  [
    "Every drill is on video",
    "Nobody guesses what a rep looks like. Every drill has a filmed demo, so technique stays clean between coached sessions.",
  ],
  [
    "Wall work gets its own days",
    "If a kid travels to a wall, the whole session uses the wall. Scanning habits are built into that wall work. No wall? The program fully works without one.",
  ],
  [
    "Accountability is built in",
    "The app tracks every drill, parents get a weekly recap from me, and I run a live film room every week. Skipped work gets seen.",
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
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
        <ShieldCheck className="h-3.5 w-3.5" /> Coach preview · read only
      </div>
      <h1 className="mt-2 font-display text-4xl font-black uppercase leading-none sm:text-5xl">
        Strive Elite
      </h1>
      <p className="mt-3 max-w-xl text-white/60">
        This is the system behind my app: how I build every player&apos;s
        week, and every drill they can be assigned. Take your time with the
        videos.
      </p>

      {/* How the course is structured - Coach Yinka's voice, quick read */}
      <section className="mt-8 space-y-3">
        {STRUCTURE.map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="font-display text-base font-bold uppercase tracking-tight">
              {title}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/55">{body}</p>
          </div>
        ))}
      </section>

      {/* The drill bank */}
      <h2 className="mt-10 font-display text-2xl font-black uppercase tracking-tight">
        The drill bank
      </h2>
      <p className="mt-1 text-sm text-white/50">
        {drills.length} drills, every one filmed. Every week I assign comes
        from this bank.
      </p>

      {pillars.map((pillar) => {
        const list = drills.filter((d) => d.pillar === pillar);
        return (
          <section key={pillar} className="mt-7">
            <h3 className="mb-2.5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight">
              <Dumbbell className="h-4 w-4 text-accent" />
              {pillar === PLYO_PILLAR ? "Plyo warm-ups" : pillar}
              <span className="text-sm font-normal normal-case text-white/35">
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
        Strive Soccer · thestriveapp.com · This preview is private, please
        don&apos;t share the link.
      </p>
    </div>
  );
}
