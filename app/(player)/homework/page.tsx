import { Dumbbell } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import { getHomework, getPlayer } from "@/lib/elite/data";
import { WeekList } from "@/components/elite/WeekList";
import { TourGuide } from "@/components/elite/TourGuide";

export default async function HomeworkPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const player = await getPlayer(viewer.playerId);
  const all = await getHomework(viewer.playerId);
  // Players only ever see unlocked weeks — scheduled weeks stay invisible
  // until they flip live Monday morning (VA time).
  const homework = all.filter((h) => h.week <= (player?.current_week ?? 1));

  return (
    <div className="space-y-6">
      {viewer.demo && <TourGuide page="training" />}

      <header className="animate-fade-up">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Week {player?.current_week} · Your workout
        </div>
        <h1 className="mt-1 flex items-center gap-2.5 font-display text-3xl font-black sm:text-4xl">
          <Dumbbell className="h-7 w-7 text-accent" /> Homework
        </h1>
        <p className="mt-2 text-white/50">
          Knock out each drill and check it off. Start with{" "}
          <span className="text-red-400">Next up</span>.
        </p>
      </header>

      <WeekList items={homework} currentWeek={player?.current_week ?? 1} />
    </div>
  );
}
