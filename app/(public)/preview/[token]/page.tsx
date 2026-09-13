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
    "Personal weekly plans",
    "Every player gets a 4 session week built around their weaknesses, age and level. About 40 minutes per session, built by the coach with AI assistance and approved before it ships.",
  ],
  [
    "Plyo first, every session",
    "Each session opens with two plyometric warm-up blocks, rotated through a filmed warm-up library so it never goes stale.",
  ],
  [
    "Every drill on video",
    "Players never guess what a rep looks like. Every drill in the bank carries a filmed demo, shot vertical for the phone in their pocket.",
  ],
  [
    "Wall days are batched",
    "A wall drill means traveling to a wall, so wall work is grouped: a session is all wall or wall free, never one wall drill lost in the middle. Players without a wall get a program that fully works without one.",
  ],
  [
    "Scanning lives inside the work",
    "Shoulder checks are built into the wall drills themselves. Speed is trained through the plyo openers. Decision making happens in film sessions with the coach, not in solo homework.",
  ],
  [
    "Accountability is automatic",
    "Completion tracking per drill, weekly parent recaps that celebrate consistency and flag missed sessions, and a weekly live Film Room call.",
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
        The full training system behind the Strive Soccer app: how a week is
        built, and every drill a player can be assigned. Nothing here is
        player data, this is the program itself.
      </p>

      {/* How the course is structured */}
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
        {drills.length} drills, every one filmed. The AI composes weekly plans
        strictly from this bank.
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
