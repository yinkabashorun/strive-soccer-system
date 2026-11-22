import Link from "next/link";
import { getViewer } from "@/lib/elite/session";
import {
  getCheckins,
  getCoachingCalls,
  getHomework,
  getMessages,
  getBenchmark,
  getPlayer,
  getProgram,
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
import { greeting, timeAgo } from "@/lib/utils";
import { TourGuide } from "@/components/elite/TourGuide";
import { featureOn } from "@/lib/elite/tiers";
import { programWeekFor } from "@/lib/elite/program";

// The player's home: one thing on screen - today's session. Under it,
// one quiet row (Extra work, the coach's note, Take a break), each folded
// until asked for (lib/elite/home.ts). Time trained shows once, beside the
// greeting; the week shows once, on the session card. A card that only
// sometimes applies (the progress clip, a call to book, the weekly
// check-in) appears between the two when it does.
export default async function DashboardPage() {
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
    calls: featureOn(player.tier, "coachingCalls"),
  };

  const [allHomework, messages, checkins, plans, calls, breaks, progressVideos, monthlyCheckin, program] =
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
      // The 3-month program (065), for the goal ladder's goal and focus.
      getProgram(player.id),
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

  return (
    <div className="space-y-4">
      {viewer.demo && <TourGuide page="home" />}

      {/* Greeting, and time trained once: the pill opens Progress (034: no
          streak, no percentage, nothing that counts what was missed) */}
      <header className="flex items-center justify-between gap-3 animate-fade-up">
        <h1 className="min-w-0 font-display text-[22px] font-black leading-none">
          {greeting()}, {firstName}
        </h1>
        {time.minutes > 0 && (
          <Link
            href="/progress"
            aria-label={`${fmtDuration(time.minutes)} trained. Open your progress`}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/30 bg-accent/[0.07] px-3.5"
          >
            <span className="font-display text-lg font-black leading-none text-accent">
              {fmtDuration(time.minutes)}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
              trained
            </span>
          </Link>
        )}
      </header>

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
          goal={{ program: program?.quiz.goal ?? null, onboarding: player.goals[0] ?? null }}
          focus={programWeekFor(program, contentWeek)?.focusName ?? null}
        />
      ) : (
        <section className="elite-card p-6 text-center">
          <p className="font-display text-2xl font-black uppercase leading-tight">
            Your first week is coming, {firstName}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-white/65">
            Your coach is building it around your profile right now. It shows up here the
            moment it is ready, and you get a notification when it does.
          </p>
        </section>
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
