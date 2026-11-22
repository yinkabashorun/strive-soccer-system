import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import { getAchievements, getHomework, getPlayer } from "@/lib/elite/data";
import { MemberCard } from "@/components/elite/MemberCard";
import { GoldRing, HoursMedal, WeeklyChart } from "@/components/elite/YouParts";
import { TourGuide } from "@/components/elite/TourGuide";
import { cardName, cardTierLabel, hoursMedals, memberSinceLabel, weeklyMinutes } from "@/lib/elite/experience";
import { fmtDuration, timeTrained } from "@/lib/elite/time-trained";
import { liveWeekFor } from "@/lib/elite/time";
import { DEFAULT_DRILL_MIN } from "@/lib/elite/time-trained";

export const metadata = { title: "You · Strive Elite" };

// You (approved mock v4, Nov 20 2026): the member card, this week's time
// in a gold ring, all-time minutes ("it only ever goes up"), the last weeks
// as bars and what has been earned. Nothing here counts what was missed:
// a quiet week is a short grey bar, never a mark against them. Progress
// (the coach's rating, goals, notes) and Account sit underneath.
export default async function YouPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const [player, homework, achievements] = await Promise.all([
    getPlayer(viewer.playerId),
    getHomework(viewer.playerId),
    getAchievements(viewer.playerId),
  ]);
  if (!player) return null;

  const live = liveWeekFor(player.week1_monday, player.current_week);
  const maxBuilt = homework.reduce((m, h) => Math.max(m, h.week), 0);
  const week = Math.max(1, Math.min(live, maxBuilt || 1));
  const time = timeTrained(homework.filter((h) => h.week <= live));
  const thisWeek = homework.filter((h) => h.week === week);
  const weekPlanned = thisWeek.reduce((s, h) => s + (h.duration_min ?? DEFAULT_DRILL_MIN), 0);
  const weekDone = thisWeek.filter((h) => h.completed).reduce((s, h) => s + (h.duration_min ?? DEFAULT_DRILL_MIN), 0);
  const bars = weeklyMinutes(homework, week, 7);
  const medals = hoursMedals(time.minutes, 4);
  const name = cardName(player.full_name);

  return (
    <div className="space-y-7">
      <header className="animate-tab-in pr-24">
        <h1 className="m-head text-[40px] leading-none">You</h1>
        <p className="mt-1.5 text-[13.5px] text-white/60">
          {name}
          {player.position ? ` · ${player.position}` : ""}
        </p>
      </header>

      {viewer.demo && <TourGuide page="progress" />}

      <MemberCard name={name} since={memberSinceLabel(player.joined_at)} tier={cardTierLabel(player.tier)} />

      <section className="flex items-center gap-5" aria-label="Time trained">
        <GoldRing
          size={132}
          value={weekPlanned > 0 ? weekDone / weekPlanned : 0}
          big={fmtDuration(weekDone)}
          small="this week"
        />
        <div className="min-w-0">
          <div className="m-num text-[46px] leading-none">{fmtDuration(time.minutes)}</div>
          <p className="mt-1.5 text-[13px] leading-snug text-white/60">
            trained, all time.
            <br />
            It only ever goes up.
          </p>
        </div>
      </section>

      <WeeklyChart bars={bars} liveWeek={week} />

      <section aria-label="Earned">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">Earned</h2>
          {achievements.length > 0 && (
            <span className="text-[13px] text-white/60">
              {achievements.length} badge{achievements.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex justify-between gap-3">
          {medals.map((m) => (
            <HoursMedal key={m.hours} hours={m.hours} earned={m.earned} />
          ))}
        </div>
        {achievements.length > 0 && (
          <ul className="mt-5 grid grid-cols-2 gap-2.5">
            {achievements.map((a) => (
              <li key={a.id} className="m-card flex items-center gap-3 p-3.5">
                <span className="metal-disc grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold">
                  {a.title.match(/\d+/)?.[0] ?? <Trophy className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-bone">{a.title}</span>
                  <span className="block truncate text-[12px] text-white/60">{a.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="m-card divide-y divide-white/[0.06] overflow-hidden" aria-label="More">
        <Row href="/progress" label="Progress" detail="Your coach's rating, your goals and notes" />
        <Row href="/account" label="Account and settings" detail="This phone, help, sign out" />
      </nav>
    </div>
  );
}

function Row({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className="press flex min-h-[60px] items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-bone">{label}</span>
        <span className="mt-0.5 block truncate text-[13px] text-white/60">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
    </Link>
  );
}
