"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Play } from "lucide-react";
import type { Homework } from "@/lib/elite/types";
import {
  drillKind,
  groupSessions,
  isDone,
  oneMoreLine,
  planSessionCount,
  planSessionsLeft,
  sessionName,
  sessionProgress,
  type SessionGroup,
  doneMinutes,
} from "@/lib/elite/session-flow";
import { sessionHeadline, sessionImage } from "@/lib/elite/experience";
import { drillPoster } from "@/lib/elite/drill-poster";
import { sessionsWord } from "@/lib/elite/training";
import { fmtDuration } from "@/lib/elite/time-trained";
import { SessionPlayer, type Origin } from "./SessionPlayer";
import { liveMinutes, useDrillState } from "./SessionRows";
import { goalLadder } from "@/lib/elite/home";
import { cn } from "@/lib/utils";

// The heart of Home (approved mock v4, Nov 20 2026): ONE card and ONE
// button. Today's session as a photo card (its first drill's still, the
// two areas it works, minutes, drills, the drills as little pictures) with
// Start session; under it the week's sessions as circles that fill gold as
// they are done, and time trained, all time. Start grows the card into the
// session (SessionPlayer). When the last session is done this same card
// becomes the week-complete card, so a player who just finished is never
// bounced to a different screen mid-moment.
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
  const { done, toggle, trained } = useDrillState();
  const [open, setOpen] = useState<{ group: SessionGroup; index: number; origin: Origin | null } | null>(null);
  const cardRef = useRef<HTMLElement>(null);

  const sessions = useMemo(() => groupSessions(rows), [rows]);
  const current = sessions.find((s) => s.list.some((h) => !isDone(h, done)));
  const allTime = liveMinutes(totalMinutes, rows, done, trained);

  const close = useCallback(() => {
    setOpen(null);
    // Bring the page behind in line with what was just done.
    router.refresh();
  }, [router]);

  if (sessions.length === 0) return null;

  const regular = sessions.filter((s) => !s.extra);
  const position = (g: SessionGroup) => regular.findIndex((s) => s.n === g.n) + 1;

  const player = open && (
    <SessionPlayer
      drills={open.group.list}
      done={done}
      onToggle={toggle}
      startIndex={open.index}
      title={sessionName(open.group)}
      headline={sessionHeadline(open.group.list)}
      eyebrow={open.group.extra ? "Extra session" : `Session ${position(open.group)} of ${regular.length}`}
      origin={open.origin}
      weekLabel={`Week ${week}`}
      firstName={firstName}
      trained={trained}
      minutesBefore={allTime - sessionProgress(open.group.list, done, trained).minutesDone}
      sessionsLeftAfter={planSessionsLeft(sessions, done, open.group.n)}
      sessionsTotal={planSessionCount(sessions)}
      weekDoneLine={nextWeekLine}
      playerId={playerId}
      sendClips={sendClips}
      example={example}
      onClose={close}
    />
  );

  const weekline = <WeekLine sessions={sessions} done={done} current={current ?? null} minutes={allTime} />;

  if (!current) {
    const weekMin = rows.reduce((s, h) => s + doneMinutes(h, done, trained), 0);
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
        {weekline}
        {player}
      </>
    );
  }

  const progress = sessionProgress(current.list, done);
  const started = progress.done > 0;
  const headline = sessionHeadline(current.list);
  const image = sessionImage(current.list);
  const planTotal = planSessionCount(sessions);
  const left = planSessionsLeft(sessions, done);
  // The goal ladder (lib/elite/home.ts): goal, this block's focus, this
  // week, then Start. It sits over the top of the photo, so Home stays
  // one screen; "One more session completes your week." sits by Start.
  const rungs = goalLadder({
    programGoal: goal?.program,
    onboardingGoal: goal?.onboarding,
    focusName: focus,
    sessionsDone: planTotal - left,
    sessionsTotal: planTotal,
  });
  const more = oneMoreLine(left);

  function start(index: number) {
    const r = cardRef.current?.getBoundingClientRect();
    setOpen({
      group: current!,
      index,
      origin: r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null,
    });
  }

  return (
    <>
      <section
        ref={cardRef}
        className="relative -mx-1.5 h-[452px] overflow-hidden rounded-[30px] bg-fill"
        aria-label={`${current.extra ? "Extra session" : `Session ${position(current)} of ${regular.length}`}, ${headline ?? "today's session"}`}
      >
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
        )}
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_12%,rgba(0,0,0,0.72)_46%,rgba(0,0,0,0.92)_64%,#000_96%)]"
          aria-hidden
        />
        {rungs.length > 0 && (
          <ol
            aria-label="Why today's session"
            className="absolute inset-x-3 top-3 space-y-1 rounded-[18px] bg-black/55 px-3.5 py-2.5 backdrop-blur-md"
          >
            {rungs.map((r) => (
              <li key={r.key} className="flex items-center gap-3">
                <span className="w-[92px] shrink-0 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                  {r.label}
                </span>
                {r.key === "week" ? (
                  <span className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums text-bone">{r.value}</span>
                    <span className="flex min-w-0 flex-1 gap-1" aria-hidden>
                      {sessions
                        .filter((g) => !g.extra)
                        .map((g) => (
                          <span
                            key={g.n}
                            className={cn(
                              "h-1 flex-1 rounded-full",
                              g.list.every((h) => isDone(h, done)) ? "bg-metal" : "bg-white/20"
                            )}
                          />
                        ))}
                    </span>
                  </span>
                ) : (
                  // One line, so Home stays one screen; the whole goal is
                  // on Progress and read in full by a screen reader.
                  <span title={r.value} className="min-w-0 flex-1 truncate text-[14px] font-semibold text-bone">
                    {r.value}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <div className="m-eyebrow">
            {started ? "Keep going" : "Today"} ·{" "}
            {current.extra ? "Extra session" : `Session ${position(current)} of ${regular.length}`}
          </div>
          <h2 className="mt-2 m-head text-[36px] leading-[1.02] text-balance">{headline ?? "Today's session"}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip>{progress.minutesTotal} min</Chip>
            <Chip>
              {progress.total} drill{progress.total === 1 ? "" : "s"}
            </Chip>
            {started && (
              <Chip>
                {progress.done} of {progress.total} done
              </Chip>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            {current.list.slice(0, 4).map((h, i) => {
              const poster = drillPoster(h.video_url);
              const ticked = isDone(h, done);
              return (
                <button
                  key={h.id}
                  onClick={() => start(i)}
                  aria-label={`Open drill ${i + 1}`}
                  className="press relative h-16 flex-1 overflow-hidden rounded-[14px] bg-fill-2"
                >
                  {poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  {drillKind(h.title) === "warmup" && (
                    <span className="absolute bottom-1 left-1.5 text-[11px] font-semibold text-white [text-shadow:0_1px_4px_#000]">
                      Warm-up
                    </span>
                  )}
                  {ticked && (
                    <span className="absolute inset-0 grid place-items-center bg-black/50">
                      <span className="metal-disc grid h-6 w-6 place-items-center rounded-full">
                        <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {more && <p className="mt-3 text-[14px] font-semibold text-bone">{more}</p>}
          <button onClick={() => start(Math.max(0, progress.nextIndex))} className="m-button mt-3">
            <Play className="h-5 w-5" fill="currentColor" />
            {started ? "Continue session" : "Start session"}
          </button>
        </div>
      </section>
      {weekline}
      {player}
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-7 items-center rounded-full bg-white/[0.12] px-3 text-[12.5px] font-semibold backdrop-blur-md">
      {children}
    </span>
  );
}

// Under the card: one circle per session (metal with a tick when done, a
// white ring for the one up next) and time trained, all time.
function WeekLine({
  sessions,
  done,
  current,
  minutes,
}: {
  sessions: SessionGroup[];
  done: Record<string, boolean | undefined>;
  current: SessionGroup | null;
  minutes: number;
}) {
  const many = sessions.length > 5;
  return (
    <div className="flex items-center justify-between gap-3 px-0.5">
      <ol className="flex gap-2" aria-label="This week's sessions">
        {sessions.map((s) => {
          const complete = s.list.every((h) => isDone(h, done));
          const now = current?.n === s.n;
          return (
            <li
              key={s.n}
              aria-label={`${sessionName(s)}${complete ? ", done" : now ? ", up next" : ""}`}
              className={cn(
                "grid place-items-center rounded-full font-display text-[17px] font-bold transition-colors duration-300",
                many ? "h-9 w-9" : "h-[46px] w-[46px]",
                complete
                  ? "metal-disc"
                  : now
                    ? "bg-black text-bone shadow-[inset_0_0_0_2.5px_#F5F4EF]"
                    : "bg-fill-2 text-white/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
              )}
            >
              {complete ? <Check className="h-4 w-4" strokeWidth={3.5} /> : s.extra ? "+" : s.n}
            </li>
          );
        })}
      </ol>
      <Link href="/you" className="press min-h-[44px] shrink-0 text-right">
        <span className="block m-num text-[28px] leading-none">{fmtDuration(minutes)}</span>
        <span className="text-[12.5px] text-white/60">trained, all time</span>
      </Link>
    </div>
  );
}

// Shown when every session is done: the week is conquered, the minutes,
// and when the next week drops. No false "new week" alert.
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
    <section className="relative -mx-1.5 overflow-hidden rounded-[30px] bg-[radial-gradient(85%_70%_at_50%_0%,#221c0d_0%,#0a0805_55%,#000_100%)] p-6 shadow-[inset_0_0_0_1px_rgba(200,168,88,0.3)]">
      <div className="flex items-center gap-2.5">
        <span className="metal-disc grid h-8 w-8 place-items-center rounded-full">
          <Check className="h-4 w-4" strokeWidth={3.5} />
        </span>
        <span className="m-eyebrow">Week {week} done</span>
      </div>
      <p className="mt-4 m-head text-[34px] leading-[1.02]">
        All {sessionsWord(totalSessions)} sessions, {firstName}.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="m-card p-3.5">
          <div className="m-num text-[26px] leading-none">{fmtDuration(minutes)}</div>
          <div className="mt-1 text-[12px] text-white/60">this week</div>
        </div>
        <div className="m-card p-3.5">
          <div className="m-num text-[26px] leading-none">{fmtDuration(totalMinutes)}</div>
          <div className="mt-1 text-[12px] text-white/60">trained, all time</div>
        </div>
      </div>
      <p className="mt-5 text-[15px] leading-relaxed text-white/75">
        Want more? Tap Extra work below to add a session. Every minute goes on your total.
      </p>
      <p className="mt-2 text-[15px] font-semibold text-bone">{nextWeekLine}</p>
    </section>
  );
}
