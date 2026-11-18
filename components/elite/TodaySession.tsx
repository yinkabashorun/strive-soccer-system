"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Play } from "lucide-react";
import type { Homework } from "@/lib/elite/types";
import {
  groupSessions,
  isDone,
  sessionName,
  sessionProgress,
  type SessionGroup,
} from "@/lib/elite/session-flow";
import { sessionsWord } from "@/lib/elite/training";
import { fmtDuration } from "@/lib/elite/time-trained";
import { SessionPlayer } from "./SessionPlayer";
import { SessionRows, WeekBar, liveMinutes, useDrillState } from "./SessionRows";

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
}: {
  week: number;
  rows: Homework[]; // every drill of the week being trained
  firstName: string;
  totalMinutes: number; // all time, as the server last counted it
  nextWeekLine: string;
  playerId?: string; // enables Send a clip (036) on skill drills
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
      sessionsLeftAfter={
        sessions.filter(
          (s) => s.n !== open.group.n && s.list.some((h) => !isDone(h, done))
        ).length
      }
      sessionsTotal={sessions.length}
      weekDoneLine={nextWeekLine}
      playerId={playerId}
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
  const position = sessions.findIndex((s) => s.n === current.n) + 1;

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
          <span>
            Week {week} ·{" "}
            {current.extra ? "Extra session" : `Session ${position} of ${sessions.length}`}
          </span>
          <span className="tabular-nums">
            {progress.done}/{progress.total}
          </span>
        </div>
        <div className="mt-2.5">
          <WeekBar sessions={sessions} done={done} />
        </div>
        <h2 className="mt-4 font-display text-[34px] font-black uppercase leading-none text-bone">
          {started ? "Keep going" : "Today's session"}
        </h2>
        <p className="mt-1.5 text-sm text-white/65">
          {progress.total} drills · about {progress.minutesTotal} min
        </p>
        <button
          onClick={() =>
            setOpen({ group: current, index: Math.max(0, progress.nextIndex) })
          }
          className="mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black transition-transform active:scale-[0.98]"
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
          Want more? Add an extra session below. Every minute goes on your total.
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
        {label}
      </div>
    </div>
  );
}
