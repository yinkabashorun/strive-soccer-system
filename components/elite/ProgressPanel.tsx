import { TrendingUp } from "lucide-react";
import type { Progress } from "@/lib/elite/types";
import { PROGRESS_METRICS } from "@/lib/elite/types";
import { ProgressBar } from "./ProgressBar";
import { ProgressRing } from "./ProgressRing";
import { overallProgress } from "@/lib/elite/data";

// Shared development-pillar panel: an overall ring plus a bar per pillar,
// ordered by the canonical metric list. Used on the player progress page
// and inside the coach's player profile.
export function ProgressPanel({ progress }: { progress: Progress[] }) {
  // No ratings yet → an honest empty state, not a page of zeros. Ratings
  // come from real coaching sessions, so this fills in after week one.
  if (progress.length === 0) {
    return (
      <div className="elite-card p-8 text-center">
        <div className="font-display text-lg font-bold uppercase tracking-tight text-white/70">
          Your baseline is coming
        </div>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/45">
          Your coach rates the seven pillars from your actual training. The
          first ratings land with your first training week, then you watch
          them climb.
        </p>
      </div>
    );
  }

  const overall = overallProgress(progress);
  const byMetric = new Map(progress.map((p) => [p.metric, p]));
  const gains = [...progress].sort(
    (a, b) => b.value - b.prev_value - (a.value - a.prev_value)
  );
  // Only celebrate a gain that actually happened.
  const biggestGain =
    gains[0] && gains[0].value > gains[0].prev_value ? gains[0] : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="elite-card flex items-center gap-5 p-6 sm:col-span-1">
          <ProgressRing value={overall} size={96} stroke={9} sublabel="Overall" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Development score
            </div>
            <div className="mt-1 text-sm text-white/55">
              Across {progress.length} pillars
            </div>
          </div>
        </div>

        {biggestGain && (
          <div className="elite-card flex flex-col justify-center p-6 sm:col-span-2">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              <TrendingUp className="h-3.5 w-3.5" /> Biggest gain
            </div>
            <div className="mt-2 font-display text-2xl font-black">
              {biggestGain.metric}{" "}
              <span className="text-accent">
                +{biggestGain.value - biggestGain.prev_value}
              </span>
            </div>
            <div className="mt-1 text-sm text-white/50">
              Up from {biggestGain.prev_value} to {biggestGain.value} this block.
            </div>
          </div>
        )}
      </div>

      <div className="elite-card space-y-4 p-6">
        {/* Only pillars that have actually been rated - no zero bars. */}
        {PROGRESS_METRICS.filter((m) => byMetric.has(m)).map((metric) => {
          const p = byMetric.get(metric)!;
          return (
            <ProgressBar
              key={metric}
              label={metric}
              value={p.value}
              prev={p.prev_value}
            />
          );
        })}
      </div>
    </div>
  );
}
