"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Play } from "lucide-react";
import type { Homework } from "@/lib/elite/types";
import {
  groupSessions,
  isDone,
  oneMoreLine,
  planSessionCount,
  planSessionsLeft,
  sessionName,
  sessionProgress,
  type SessionGroup,
} from "@/lib/elite/session-flow";
import { sessionsWord } from "@/lib/elite/training";
import { fmtDuration } from "@/lib/elite/time-trained";
import { SessionPlayer } from "./SessionPlayer";
import { SessionRows, WeekBar, liveMinutes, useDrillState } from "./SessionRows";
import { goalLadder } from "@/lib/elite/home";

// The heart of the player's home: ONE thing to do. The next session of the
// week as a short list with one big Start button; Start opens the session
// full screen, one drill at a time (SessionPlayer). When the last session
// is done this same card becomes the week-complete card, so a player who
// just finished is never bounced to a different screen mid-moment.
export function TodaySession({
  week,
  rows,
  firstName,
  totalMinutes,
  nextWeekLine,
  playerId,
  sendClips = true,
  example = false,
  goal = null,
  focus = null,
}: {
  week: number;
  rows: Homework[]; // every drill of the week being trained
  firstName: string;
  totalMinutes: number; // all time, as the server last counted it
  nextWeekLine: string;
  playerId?: string; // enables Send a clip (036) on skill drills
  sendClips?: boolean; // false for an offer without Send a clip (lib/elite/tiers.ts)
  example?: boolean; // the example player
  goal?: { program: string | null; onboarding: string | null } | null; // the ladder's top rung
  focus?: string | null; // the 3-month program's focus this week, by name
}) {
  const router = useRouter();
  const { done, toggle } = useDrillState();
  const [open, setOpen] = useState<{ group: SessionGroup; index: number } | null>(null);

  const sessions = useMemo(() => groupSessions(rows), [rows]);
  const current = sessions.find((s) => s.list.some((h) => !isDone(h, done)));
  const allTime = liveMinutes(totalMinutes, rows, done);

  const close = useCallback(() => {
    setOpen(null);
    // Bring the page behind in line with what was just done.
    router.refresh();
  }, [router]);

  if (sessions.length === 0) return null;

  const player = open && (
    <SessionPlayer
      drills={open.group.list}
      done={done}
      onToggle={toggle}
      startIndex={open.index}
      title={sessionName(open.group)}
      weekLabel={`Week ${week}`}
      firstName={firstName}
      minutesBefore={allTime - sessionProgress(open.group.list, done).minutesDone}
      sessionsLeftAfter={planSessionsLeft(sessions, done, open.group.n)}
      sessionsTotal={planSessionCount(sessions)}
      weekDoneLine={nextWeekLine}
      playerId={playerId}
      sendClips={sendClips}
      example={example}
      onClose={close}
    />
  );

  if (!current) {
    const weekMin = rows.filter((h) => isDone(h, done)).reduce((s, h) => s + (h.duration_min ?? 15), 0);
    return (
      <>
        <VictoryLap
          week={week}
          firstName={firstName}
          minutes={weekMin}
          totalMinutes={allTime}
          nextWeekLine={nextWeekLine}
          totalSessions={sessions.length}
        />
        {player}
      </>
    );
  }

  const progress = sessionProgress(current.list, done);
  const started = progress.done > 0;
  const planTotal = planSessionCount(sessions);
  const left = planSessionsLeft(sessions, done);
  // The goal ladder (lib/elite/home.ts): goal, this block's focus, this
  // week, then the Start button. The week's bars sit on the last rung.
  const rungs = goalLadder({
    programGoal: goal?.program,
    onboardingGoal: goal?.onboarding,
    focusName: focus,
    sessionsDone: planTotal - left,
    sessionsTotal: planTotal,
  });
  const more = oneMoreLine(left);

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <div className="p-5 pb-4">
        <ol aria-label="Why today's session" className="space-y-0.5 border-l-2 border-accent/50 pl-3">
          {rungs.map((r) => (
            <li key={r.key} className="flex items-baseline gap-3">
              <span className="w-[74px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                {r.label}
              </span>
              {r.key === "week" ? (
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums text-bone">{r.value}</span>
                  <span className="min-w-0 flex-1">
                    <WeekBar sessions={sessions} done={done} />
                  </span>
                </span>
              ) : (
                // One line, so Home stays one screen; the whole goal is
                // on Progress and read in full by a screen reader.
                <span title={r.value} className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-snug text-bone">
                  {r.value}
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex items-end justify-between gap-3">
          <h2 className="font-display text-[34px] font-black uppercase leading-none text-bone">
            {current.extra ? "Extra session" : started ? "Keep going" : "Today's session"}
          </h2>
          <p className="shrink-0 text-right text-[13px] leading-tight text-white/65" aria-label={`Week ${week}, ${progress.total} drills, about ${progress.minutesTotal} minutes`}>
            Week {week} · {progress.total} drills
            <br />
            about {progress.minutesTotal} min
          </p>
        </div>
        {more && <p className="mt-2 text-sm font-semibold text-accent">{more}</p>}
        <button
          onClick={() =>
            setOpen({ group: current, index: Math.max(0, progress.nextIndex) })
          }
          className="mt-3.5 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black transition-transform active:scale-[0.98]"
        >
          <Play className="h-5 w-5" fill="currentColor" />
          {started ? "Continue session" : "Start session"}
        </button>
      </div>

      <div className="border-t border-white/[0.06] px-1.5 pb-1.5">
        <SessionRows
          drills={current.list}
          done={done}
          onToggle={toggle}
          onOpen={(index) => setOpen({ group: current, index })}
          compact
        />
      </div>

      {player}
    </section>
  );
}

// Shown when every session is done: the week is conquered - stats, a
// bonus option, and when the next week drops. No false "new week" alert.
export function VictoryLap({
  week,
  firstName,
  minutes,
  totalMinutes,
  nextWeekLine,
  totalSessions = 4,
}: {
  week: number;
  firstName: string;
  minutes: number; // this week's completed minutes
  totalMinutes: number; // all time (034: progress is time trained, never a streak)
  nextWeekLine: string;
  totalSessions?: number; // four In-Season, six Off-Season, plus any extras
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-accent/35 bg-gradient-to-br from-accent/[0.10] to-transparent p-6">
      <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-black">
            <Check className="h-3 w-3" strokeWidth={4} />
          </span>
          Week {week} complete
        </div>
        <p className="mt-2 font-display text-[34px] font-black uppercase leading-none">
          All {sessionsWord(totalSessions)} sessions, {firstName}.
        </p>
        <div className="mt-5 flex flex-wrap gap-6 text-sm">
          <Stat label="Sessions" value={`${totalSessions}/${totalSessions}`} />
          <Stat label="This week" value={fmtDuration(minutes)} />
          <Stat label="All time" value={fmtDuration(totalMinutes)} />
        </div>
        <p className="mt-5 text-[15px] leading-relaxed text-white/75">
          Want more? Tap Extra work below to add a session. Every minute goes on your total.
        </p>
        <p className="mt-2 text-[15px] font-medium text-bone">{nextWeekLine}</p>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-3xl font-black tabular-nums text-accent">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
        {label}
      </div>
    </div>
  );
}
