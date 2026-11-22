import Link from "next/link";
import { ChevronRight, Clapperboard } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import {
  getCheckins,
  getCoachingCalls,
  getHomework,
  getMessages,
  getBenchmark,
  getPlayer,
  getProgressVideos,
  getTrainingBreaks,
  getWeeklyPlans,
} from "@/lib/elite/data";
import { TodaySession } from "@/components/elite/TodaySession";
import { HomeMore } from "@/components/elite/HomeMore";
import { BreakCard } from "@/components/elite/BreakCard";
import { ProgressVideoCard } from "@/components/elite/ProgressVideoCard";
import { previousProgressVideo, progressVideoDue } from "@/lib/elite/progress-video";
import { currentBreak } from "@/lib/elite/breaks";
import { settleBreaksForPlayer } from "@/lib/elite/breaks-server";
import { fmtDuration, timeTrained } from "@/lib/elite/time-trained";
import { CoachingCallsCard } from "@/components/elite/CoachingCallsCard";
import { CheckinBooking } from "@/components/elite/CheckinBooking";
import { getPlayerCheckin } from "@/lib/elite/film-room-data";
import { CheckinCard } from "@/components/elite/CheckinCard";
import { fmtMonday, liveWeekFor, nextMondayNY, nyToday } from "@/lib/elite/time";
import { timeAgo } from "@/lib/utils";
import { WeekDrop, type DropCard } from "@/components/elite/WeekDrop";
import { groupSessions, sessionProgress } from "@/lib/elite/session-flow";
import { mondayOfProgramWeek, sessionImage, shortDate, todayName, weekRange } from "@/lib/elite/experience";
import { sessionsWord } from "@/lib/elite/training";
import { getNextFilmRoom } from "@/lib/elite/film-room-data";
import { TourGuide } from "@/components/elite/TourGuide";
import { featureOn } from "@/lib/elite/tiers";

// The player's home: one thing on screen - today's session. Under it,
// one quiet row (Extra work, the coach's note, Take a break), each folded
// until asked for (lib/elite/home.ts). Time trained shows once, beside the
// greeting; the week shows once, on the session card. A card that only
// sometimes applies (the progress clip, a call to book, the weekly
// check-in) appears between the two when it does.
export default async function DashboardPage({
  searchParams,
}: {
  // ?drop=1: the example player can see the drop again (the sales tour);
  // a member's drop follows the once-a-week rule only.
  searchParams?: { drop?: string };
}) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null; // layout renders the "almost there" state

  const player = await getPlayer(viewer.playerId);
  if (!player) return null;

  // A break that ended since the last visit (034): move the program clock
  // first, so everything below reads the week they come back to.
  if (!viewer.demo) {
    const { week1Monday } = await settleBreaksForPlayer(player);
    player.week1_monday = week1Monday;
  }

  // What this member's offer includes (029, 074: lib/elite/tiers.ts).
  const has = {
    chat: featureOn(player.tier, "coachChat"),
    clips: featureOn(player.tier, "sendClip"),
    progressVideo: featureOn(player.tier, "progressVideo"),
    monthlyCheckin: featureOn(player.tier, "monthlyCheckin"),
    filmRoom: featureOn(player.tier, "filmRoom"),
    calls: featureOn(player.tier, "coachingCalls"),
  };

  const [allHomework, messages, checkins, plans, calls, breaks, progressVideos, monthlyCheckin, filmRoom] =
    await Promise.all([
      getHomework(player.id),
      getMessages(player.id),
      getCheckins(player.id),
      getWeeklyPlans(player.id),
      getCoachingCalls(player.id),
      getTrainingBreaks(player.id),
      getProgressVideos(player.id),
      viewer.demo || !has.monthlyCheckin
        ? Promise.resolve({ booked: null, open: [] })
        : getPlayerCheckin(player.id),
      has.filmRoom && !viewer.demo ? getNextFilmRoom().catch(() => null) : Promise.resolve(null),
    ]);

  const firstName = player.full_name.split(" ")[0];
  const today = nyToday();
  const onBreak = currentBreak(breaks, today);
  // Progress is time trained (034): what was done, never what was missed.
  const time = timeTrained(allHomework);

  // Weeks are DERIVED from the calendar, never a stored counter: the live
  // week comes from week1_monday (flips Monday automatically), and the
  // player trains their latest built week if the coach is behind.
  const live = liveWeekFor(player.week1_monday, player.current_week);
  const maxBuilt = allHomework.reduce((m, h) => Math.max(m, h.week), 0);
  const contentWeek = Math.max(1, Math.min(live, maxBuilt || 1));

  // Only unlocked weeks exist for the player.
  const homework = allHomework.filter((h) => h.week <= live);
  const thisWeek = homework.filter((h) => h.week === contentWeek);

  // Group the live week into its sessions; the hero is the first session
  // with anything left to do.
  const bySession = new Map<number, typeof thisWeek>();
  for (const h of thisWeek) {
    const s = h.session ?? 1;
    bySession.set(s, [...(bySession.get(s) ?? []), h]);
  }
  const sessions = [...bySession.entries()]
    .map(([n, list]) => ({ n, list: [...list].sort((a, b) => a.sort - b.sort) }))
    .sort((a, b) => a.n - b.n);
  const current = sessions.find((s) => s.list.some((h) => !h.completed));
  const weekDone = sessions.length > 0 && !current;

  // What to say about next week - never a false "it's ready".
  const nextScheduled = plans.find(
    (p) =>
      p.week > contentWeek &&
      p.unlocks_at &&
      new Date(p.unlocks_at).getTime() > Date.now()
  );
  const nextWeekLine = nextScheduled
    ? `Week ${nextScheduled.week} unlocks ${fmtMonday(nextMondayNY())}.`
    : maxBuilt < live
      ? `Your coach is building week ${live}. It lands the moment it's ready.`
      : `Your coach is building week ${live + 1}. It drops Monday.`;

  const checkedInThisWeek = checkins.some((c) => c.week === contentWeek);

  // Bi-weekly progress video (037): every second week, the same drill.
  // Needs a drill to film (the coach's pick or the first skill drill ever
  // completed) and a week that exists; never while on a break.
  const videoDue =
    has.progressVideo && !onBreak && thisWeek.length > 0 && progressVideoDue(contentWeek, progressVideos);
  const benchmark = videoDue ? await getBenchmark(player, allHomework) : null;
  const previousVideo = previousProgressVideo(contentWeek, progressVideos);

  // The coach's latest word to the player (their own messages are not it).
  const coachNote = has.chat ? messages.find((m) => m.from_role !== "player") ?? null : null;
  const extraOpen = sessions.some(
    (s) => s.list.some((h) => h.is_extra) && s.list.some((h) => !h.completed)
  );

  // The drop (experience.ts): the week's sessions as they land, shown
  // once per new week before anything in it is done.
  const plan = plans.find((p) => p.week === contentWeek);
  const regular = groupSessions(thisWeek).filter((g) => !g.extra);
  const dropCards: DropCard[] = regular.map((g, i) => {
    const p = sessionProgress(g.list, {});
    return {
      n: g.n,
      label: `Session ${i + 1}`,
      line: `${i === 0 ? "Today · " : ""}${p.total} drills · ${p.minutesTotal} min`,
      image: sessionImage(g.list),
    };
  });
  const sessionsCount = sessionsWord(regular.length);
  const dropLine = `${sessionsCount.charAt(0).toUpperCase()}${sessionsCount.slice(1)} sessions. ${
    plan?.focus?.trim() || "Built from your answers and how your training goes."
  }`;

  return (
    <div className="space-y-4">
      {/* The day and the week, the way the approved Home opens. Time
          trained shows once, under the card (034: no streak, no
          percentage, nothing that counts what was missed). */}
      <header className="pr-24">
        <h1 className="m-head text-[40px] leading-none">{todayName()}</h1>
        <p className="mt-1.5 text-[13.5px] text-white/60">
          {sessions.length > 0 ? `Week ${contentWeek} · ` : ""}
          {shortDate()}
        </p>
      </header>

      {viewer.demo && <TourGuide page="home" />}

      {sessions.length > 0 && !onBreak && (
        <WeekDrop
          playerId={player.id}
          week={contentWeek}
          range={weekRange(mondayOfProgramWeek(player.week1_monday, contentWeek))}
          line={dropLine}
          cards={dropCards}
          anyDone={thisWeek.some((h) => h.completed)}
          replay={viewer.demo && searchParams?.drop === "1"}
        />
      )}

      {/* THE thing: today's session (or the victory lap, or the break) */}
      {onBreak ? (
        <BreakCard current={onBreak} firstName={firstName} today={today} />
      ) : sessions.length > 0 ? (
        // One client card for the whole week: the next session with its
        // Start button, or the week-complete card once every session is
        // done. It stays mounted across both, so the finish screen of the
        // last session is never cut off by the page refreshing behind it.
        <TodaySession
          week={contentWeek}
          rows={thisWeek}
          firstName={firstName}
          totalMinutes={time.minutes}
          nextWeekLine={nextWeekLine}
          playerId={player.id}
          sendClips={has.clips}
          example={viewer.demo}
        />
      ) : (
        <section className="m-card px-6 py-8 text-center">
          <p className="m-head text-[30px] leading-[1.02]">Your first week is coming, {firstName}</p>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-white/65">
            Your coach is building it around your answers. It shows up here the moment it is ready,
            and you get a notification when it does.
          </p>
        </section>
      )}

      {/* The Film Room (062) for an offer that has it: a card here, not a
          tab. Its page has the Zoom link and the clip upload. */}
      {has.filmRoom && (
        <Link href="/film" className="press m-card flex min-h-[72px] items-center gap-3.5 px-4 py-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fill-2 text-bone">
            <Clapperboard className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-bone">Film Room</span>
            <span className="mt-0.5 block truncate text-[13px] text-white/60">
              {filmRoom
                ? `${new Date(filmRoom.scheduled_at).toLocaleDateString("en-US", {
                    weekday: "long",
                    timeZone: "America/New_York",
                  })} on Zoom. Send your clips before it.`
                : "Upload clips from your games for the next one."}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
        </Link>
      )}

      {/* Progress video (037): asked once per even week, same drill */}
      {videoDue && benchmark && !viewer.demo && (
        <ProgressVideoCard
          playerId={player.id}
          week={contentWeek}
          firstName={firstName}
          parentFirst={(player.parent_name || "").trim().split(" ")[0]}
          benchmark={{ title: benchmark.title, video_url: benchmark.video_url }}
          previousUrl={previousVideo?.clip_url ?? null}
        />
      )}

      {/* Monthly check-in call (062): the call you hold and the times you
          can book. Shows nothing when there is nothing to book. */}
      {!viewer.demo && has.monthlyCheckin && <CheckinBooking checkin={monthlyCheckin} firstName={firstName} />}

      {/* Weekly 1:1 call - Complete Pathway only (029). Elite and Pro
          never see this; the demo tour doesn't cover calls. */}
      {has.calls && !viewer.demo && (
        <CoachingCallsCard calls={calls} />
      )}

      {/* Check-in appears once the week is conquered */}
      {(weekDone || checkedInThisWeek) && (
        <CheckinCard
          week={contentWeek}
          alreadyDone={checkedInThisWeek}
          firstName={firstName}
        />
      )}

      {/* The one quiet row: Extra work (033: a session from the bank,
          never a repeat, one open extra at a time, enforced server-side),
          the coach's latest note, and Take a break (034: a date, not a
          penalty). Each opens in place. */}
      <HomeMore
        extra={
          sessions.length > 0
            ? {
                hasWall: player.has_wall === true,
                blocked: extraOpen
                  ? "Finish the extra session you already added, then add another."
                  : null,
              }
            : null
        }
        note={coachNote ? { body: coachNote.body, when: timeAgo(coachNote.created_at) } : null}
        breakFrom={!onBreak && !viewer.demo ? { firstName, today } : null}
      />
    </div>
  );
}
