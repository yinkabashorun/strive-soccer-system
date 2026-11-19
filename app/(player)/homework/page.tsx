import { getViewer } from "@/lib/elite/session";
import { getHomework, getPlayer } from "@/lib/elite/data";
import { liveWeekFor } from "@/lib/elite/time";
import { timeTrained } from "@/lib/elite/time-trained";
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
        <h1 className="font-display text-4xl font-black uppercase leading-none">Your week</h1>
        <p className="mt-2 text-[15px] text-white/65">
          Open a session and work through it one drill at a time.
        </p>
      </header>

      <WeekList
        items={homework}
        currentWeek={contentWeek}
        playerId={viewer.playerId}
        example={viewer.demo}
        firstName={(player?.full_name ?? "").split(" ")[0]}
        totalMinutes={timeTrained(all).minutes}
      />
    </div>
  );
}
