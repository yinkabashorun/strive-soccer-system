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
  const overall = overallProgress(progress);
  const byMetric = new Map(progress.map((p) => [p.metric, p]));
  const biggestGain = [...progress].sort(
    (a, b) => b.value - b.prev_value - (a.value - a.prev_value)
  )[0];

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
              Across {progress.length || PROGRESS_METRICS.length} pillars
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
        {PROGRESS_METRICS.map((metric) => {
          const p = byMetric.get(metric);
          return (
            <ProgressBar
              key={metric}
              label={metric}
              value={p?.value ?? 0}
              prev={p?.prev_value}
            />
          );
        })}
      </div>
    </div>
  );
}
