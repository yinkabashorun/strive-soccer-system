import type { Metadata } from "next";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { PLYO_PILLAR, PROGRESS_METRICS, type Drill } from "@/lib/elite/types";
import { DrillVideo } from "@/components/elite/DrillVideo";
import { Wordmark } from "@/components/elite/Wordmark";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Strive Elite",
  description: "Every drill, on video. This is the training system.",
  openGraph: {
    title: "Strive Elite",
    description: "Every drill, on video. This is the training system.",
    type: "website",
  },
};

// Video-first public demo. No login, no player data, almost no copy - the
// drill bank does the selling. Pairs with the announcement: DM "APP".
export default async function DemoPage() {
  const admin = createServiceClient();
  const { data } = admin
    ? await admin.from("elite_drills").select("*").eq("active", true).order("sort")
    : { data: null };
  const drills = (data ?? []) as Drill[];

  const pillars = [PLYO_PILLAR, ...PROGRESS_METRICS].filter((p) =>
    drills.some((d) => d.pillar === p)
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Wordmark href={null} size="lg" />
      <p className="mt-2 text-sm text-white/45">
        Every drill your player gets, on video.
      </p>

      {pillars.map((pillar) => {
        const list = drills.filter((d) => d.pillar === pillar);
        return (
          <section key={pillar} className="mt-8">
            <h2 className="mb-2.5 font-display text-sm font-bold uppercase tracking-wider text-white/50">
              {pillar === PLYO_PILLAR ? "Warm-ups" : pillar}
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {list.map((d) =>
                d.video_url ? (
                  <DrillVideo key={d.id} src={d.video_url} label={d.title} />
                ) : null
              )}
            </div>
          </section>
        );
      })}

      <div className="mt-10 rounded-2xl border border-accent/30 bg-accent/[0.06] p-5 text-center">
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
