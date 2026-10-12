import { Clock } from "lucide-react";
import { fmtDuration, type TimeTrained } from "@/lib/elite/time-trained";
import { StatTile } from "./StatTile";

// Progress as the family sees it (034): time trained, sessions done,
// weeks trained, minutes by pillar. No percentage, no streak, nothing
// that counts what was missed. Shown on the player's progress page above
// the coach's ratings.
export function TimeTrainedPanel({ time }: { time: TimeTrained }) {
  if (time.minutes === 0) {
    return (
      <div className="elite-card p-8 text-center">
        <div className="font-display text-lg font-bold uppercase tracking-tight text-white/70">
          Your first minutes are coming
        </div>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/45">
          Every drill you check off adds to your total. It only ever goes up.
        </p>
      </div>
    );
  }
  const top = time.byPillar[0]?.minutes ?? 0;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Time trained" value={fmtDuration(time.minutes)} sub="All time" accent />
        <StatTile label="Sessions" value={time.sessions} sub="Done" />
        <StatTile label="Weeks" value={time.weeks} sub="Trained" />
      </div>
      {time.byPillar.length > 0 && (
        <div className="elite-card space-y-3 p-6">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            <Clock className="h-3.5 w-3.5" /> Where the time went
          </div>
          {time.byPillar.map((p) => (
            <div key={p.pillar}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/75">{p.pillar}</span>
                <span className="font-display font-bold tabular-nums text-bone">{fmtDuration(p.minutes)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${top ? Math.max(4, Math.round((p.minutes / top) * 100)) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
