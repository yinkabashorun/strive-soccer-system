import { getViewer } from "@/lib/elite/session";
import { getHomework, getPlayer, getWeeklyPlans } from "@/lib/elite/data";
import { liveWeekFor } from "@/lib/elite/time";
import { timeTrained } from "@/lib/elite/time-trained";
import { mondayOfProgramWeek, weekRange } from "@/lib/elite/experience";
import { WeekList } from "@/components/elite/WeekList";
import { TourGuide } from "@/components/elite/TourGuide";
import { featureOn } from "@/lib/elite/tiers";

export const metadata = { title: "Week · Strive Elite" };

// The Week tab (approved mock v4): the week's number and dates, what this
// week goes after in the plan's own words, then the sessions as photo
// cards (WeekList). The route stays /homework so every old link works.
export default async function HomeworkPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const [player, all, plans] = await Promise.all([
    getPlayer(viewer.playerId),
    getHomework(viewer.playerId),
    getWeeklyPlans(viewer.playerId),
  ]);
  // Weeks derive from the calendar: unlocked weeks flip live Monday
  // automatically, and "this week" is the latest built week within the
  // live one.
  const live = liveWeekFor(player?.week1_monday, player?.current_week);
  const maxBuilt = all.reduce((m, h) => Math.max(m, h.week), 0);
  const contentWeek = Math.max(1, Math.min(live, maxBuilt || 1));
  const homework = all.filter((h) => h.week <= live);
  const range = weekRange(mondayOfProgramWeek(player?.week1_monday, contentWeek));
  const focus = plans.find((p) => p.week === contentWeek)?.focus?.trim();

  return (
    <div className="space-y-5">
      <header className="pr-24">
        <h1 className="m-head text-[40px] leading-none">{maxBuilt > 0 ? `Week ${contentWeek}` : "Your week"}</h1>
        {range && <p className="mt-1.5 text-[13.5px] text-white/60">{range}</p>}
        {focus && <p className="mt-3.5 text-[16px] leading-snug text-bone">{focus}</p>}
      </header>

      {viewer.demo && <TourGuide page="training" />}

      <WeekList
        items={homework}
        currentWeek={contentWeek}
        playerId={viewer.playerId}
        sendClips={featureOn(player?.tier, "sendClip")}
        example={viewer.demo}
        firstName={(player?.full_name ?? "").split(" ")[0]}
        totalMinutes={timeTrained(all).minutes}
      />
    </div>
  );
}
