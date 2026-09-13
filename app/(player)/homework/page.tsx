import { Dumbbell } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import { getHomework, getPlayer } from "@/lib/elite/data";
import { liveWeekFor } from "@/lib/elite/time";
import { WeekList } from "@/components/elite/WeekList";
import { TourGuide } from "@/components/elite/TourGuide";

export default async function HomeworkPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const player = await getPlayer(viewer.playerId);
  const all = await getHomework(viewer.playerId);
  // Weeks derive from the calendar: unlocked weeks flip live Monday
  // automatically, and "this week" is the latest built week within the
  // live one.
  const live = liveWeekFor(player?.week1_monday, player?.current_week);
  const maxBuilt = all.reduce((m, h) => Math.max(m, h.week), 0);
  const contentWeek = Math.max(1, Math.min(live, maxBuilt || 1));
  const homework = all.filter((h) => h.week <= live);

  return (
    <div className="space-y-6">
      {viewer.demo && <TourGuide page="training" />}

      <header className="animate-fade-up">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Week {contentWeek} · Your workout
        </div>
        <h1 className="mt-1 flex items-center gap-2.5 font-display text-3xl font-black sm:text-4xl">
          <Dumbbell className="h-7 w-7 text-accent" /> Homework
        </h1>
        <p className="mt-2 text-white/50">
          Knock out each drill and check it off. Start with{" "}
          <span className="text-red-400">Next up</span>.
        </p>
      </header>

      <WeekList items={homework} currentWeek={contentWeek} />
    </div>
  );
}
