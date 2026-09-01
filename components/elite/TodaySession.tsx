"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Flame } from "lucide-react";
import type { Homework } from "@/lib/elite/types";
import { toggleHomework } from "@/lib/elite/player-actions";
import { cn } from "@/lib/utils";

// The heart of the player experience: ONE session on screen - the plyo
// warm-up plus two drills - with big satisfying tap-to-complete targets
// and a proper completion moment when the session is done.
export function TodaySession({
  session,
  totalSessions,
  drills,
  firstName,
}: {
  session: number;
  totalSessions: number;
  drills: Homework[];
  firstName: string;
}) {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(drills.map((d) => [d.id, d.completed]))
  );
  const [justFinished, setJustFinished] = useState(false);
  const [, start] = useTransition();

  const doneCount = useMemo(
    () => drills.filter((d) => state[d.id]).length,
    [drills, state]
  );
  const allDone = doneCount === drills.length && drills.length > 0;

  function toggle(id: string) {
    const next = !state[id];
    const nextState = { ...state, [id]: next };
    setState(nextState);
    const nowAllDone =
      drills.every((d) => nextState[d.id]) && drills.length > 0;
    if (nowAllDone && !allDone) setJustFinished(true);
    start(() => {
      toggleHomework(id, next);
    });
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border p-5 transition-colors duration-500 sm:p-6",
        allDone
          ? "border-accent/40 bg-accent/[0.06]"
          : "border-white/10 bg-white/[0.02]"
      )}
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
          Today · Session {session} of {totalSessions}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          {doneCount}/{drills.length} done
        </div>
      </div>
      {allDone && (
        <p className="mt-1.5 font-display text-2xl font-black uppercase leading-tight sm:text-3xl">
          Session complete, {firstName}
        </p>
      )}

      {/* completion moment */}
      {allDone ? (
        <div className={cn("mt-4", justFinished && "animate-fade-up")}>
          <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-black/40 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-black">
              <Flame className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold text-bone">
                {FUTURE_PACE[(session - 1) % FUTURE_PACE.length]}
              </div>
              <div className="text-sm text-white/55">
                {session < totalSessions
                  ? `Session ${session + 1} is waiting when you are.`
                  : "That was the last session of the week."}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {drills.map((d, i) => {
            const done = Boolean(state[d.id]);
            const isPlyo = i === 0;
            return (
              <li key={d.id}>
                <button
                  onClick={() => toggle(d.id)}
                  className={cn(
                    "flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
                    done
                      ? "border-accent/30 bg-accent/[0.05]"
                      : isPlyo
                        ? "border-red-500/25 bg-red-500/[0.04] hover:border-red-500/40"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  )}
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-all",
                      done
                        ? "border-accent bg-accent text-black"
                        : "border-white/25 text-transparent"
                    )}
                  >
                    <Check className="h-5 w-5" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "flex items-center gap-2 font-semibold",
                        done ? "text-white/45 line-through" : "text-bone"
                      )}
                    >
                      {isPlyo && !done && (
                        <span className="rounded bg-red-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                          Start here
                        </span>
                      )}
                      {d.title}
                    </span>
                    {!done && (
                      <span className="mt-0.5 block text-sm leading-snug text-white/50">
                        {d.exercise}
                      </span>
                    )}
                  </span>
                  {d.reps && (
                    <span className="chip shrink-0 whitespace-nowrap">
                      {d.reps}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Completion lines rotate by session number. Each one points at the game,
// not the workout: the rep they just did is a moment they'll live on the
// field. Future pacing, built into the loop.
const FUTURE_PACE = [
  "Those touches show up Saturday.",
  "Somewhere, the kid guarding you skipped today.",
  "That rep is a defender you beat this weekend.",
  "Game speed is built on days like this.",
];

// Shown when all four sessions are done: the week is conquered - stats,
// a bonus option, and when the next week drops. No false "new week" alert.
export function VictoryLap({
  week,
  firstName,
  minutes,
  streak,
  nextWeekLine,
}: {
  week: number;
  firstName: string;
  minutes: number;
  streak: number;
  nextWeekLine: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-accent/35 bg-gradient-to-br from-accent/[0.10] to-transparent p-6">
      <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
          Week {week} complete
        </div>
        <p className="mt-1.5 font-display text-3xl font-black uppercase leading-none">
          All four sessions, {firstName}.
        </p>
        <div className="mt-4 flex flex-wrap gap-5 text-sm">
          <Stat label="Sessions" value="4/4" />
          <Stat label="Minutes" value={String(minutes)} />
          <Stat label="Streak" value={`${streak}d`} />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/65">
          Four sessions nobody watched. The next game is where they show.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          Victory lap: rerun your favorite session or get free plyo reps in.
          It keeps the streak alive.
        </p>
        <p className="mt-2 text-sm font-medium text-white/80">{nextWeekLine}</p>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-black text-accent">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>
    </div>
  );
}
