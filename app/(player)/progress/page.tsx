import { BarChart3, StickyNote } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import { getHomework, getNotes, getPlayer, getProgress } from "@/lib/elite/data";
import { ProgressPanel } from "@/components/elite/ProgressPanel";
import { TimeTrainedPanel } from "@/components/elite/TimeTrainedPanel";
import { timeTrained } from "@/lib/elite/time-trained";
import { timeAgo } from "@/lib/utils";
import { TourGuide } from "@/components/elite/TourGuide";

export default async function ProgressPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const [player, progress, notes, homework] = await Promise.all([
    getPlayer(viewer.playerId),
    getProgress(viewer.playerId),
    getNotes(viewer.playerId),
    getHomework(viewer.playerId),
  ]);
  // Progress is time trained (034): what was done, never what was missed.
  const time = timeTrained(homework);

  return (
    <div className="space-y-6">
      {viewer.demo && <TourGuide page="progress" />}

      <header className="animate-fade-up">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          {player?.position} · {player?.level}
        </div>
        <h1 className="mt-1 flex items-center gap-2.5 font-display text-3xl font-black sm:text-4xl">
          <BarChart3 className="h-7 w-7 text-accent" /> Progress
        </h1>
        <p className="mt-2 text-white/50">
          Every minute you train counts, and it only ever adds up. A break never
          takes anything away.
        </p>
      </header>

      <TimeTrainedPanel time={time} />

      {/* The coach's rating of the seven pillars, kept under its own name.
          Green means trending up. */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-tight">
          Coach&apos;s rating
        </h2>
        <ProgressPanel progress={progress} />
      </section>

      {/* Goals */}
      {player && player.goals.length > 0 && (
        <section className="elite-card p-6">
          <h2 className="font-display text-lg font-bold uppercase tracking-tight">
            Your goals
          </h2>
          <ul className="mt-4 space-y-2.5">
            {player.goals.map((g, i) => (
              <li key={i} className="flex items-start gap-3 text-white/70">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {g}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Coach notes */}
      {notes.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
            <StickyNote className="h-4 w-4 text-accent" /> Coach notes
          </h2>
          <div className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="elite-card p-5">
                <p className="text-sm leading-relaxed text-white/75">{n.body}</p>
                <div className="mt-2 text-xs text-white/35">
                  {timeAgo(n.created_at)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
