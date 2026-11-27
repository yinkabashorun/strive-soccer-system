// The set timer inside a drill (Nov 18 2026): the pure rules.
//
// A drill's sets and rest are written by the coach as plain words ("3 x 1
// min, rest 30 sec"). parseReps reads the shapes the bank actually uses and
// NOTHING else: when the words do not clearly say a number of sets with a
// timed set or a timed rest, there is no timer, and the drill shows its
// words exactly as before. It never invents a time the coach did not write.
//
// The timer then walks the sets: get ready, work, rest, work ... done.
//   - a timed set ("3 x 1 min") counts down on its own;
//   - a counted set ("3 x 10 reps, rest 30 sec") waits for the player to
//     tap "Set done", then times the rest;
//   - a timed set with no rest written ("3 x 30 sec") waits between sets
//     for the player to start the next one.

export type RepsPlan = {
  sets: number;
  workSec: number | null; // null: the set is counted, not timed
  restSec: number | null; // null: no rest written
};

const UNIT = "(sec|secs|second|seconds|min|mins|minute|minutes)";
const NUM = "(\\d+(?:\\.\\d+)?)";

function seconds(n: string, unit: string): number {
  const v = Number(n);
  return Math.round(unit.startsWith("min") ? v * 60 : v);
}

function within(v: number | null, min: number, max: number): boolean {
  return v === null || (v >= min && v <= max);
}

export function parseReps(reps: string | null | undefined): RepsPlan | null {
  if (!reps) return null;
  const t = reps.toLowerCase().trim();

  let sets: number;
  let workSec: number | null = null;

  // "3 x 1 min", "3 x 10 reps", "3 sets of 5 jumps"
  const head = t.match(new RegExp(`^(\\d+)\\s*(?:x|sets? of)\\s*${NUM}(?:\\s*${UNIT}\\b)?`));
  // "5 mins" on its own: one timed set
  const single = t.match(new RegExp(`^${NUM}\\s*${UNIT}$`));

  if (head) {
    sets = Number(head[1]);
    // "3 x 30 to 45 sec" is a range: the set is the player's to count
    const range = new RegExp(`^(\\d+)\\s*(?:x|sets? of)\\s*${NUM}\\s*(?:to|-)\\s*\\d`).test(t);
    if (head[3] && !range) workSec = seconds(head[2], head[3]);
  } else if (single) {
    sets = 1;
    workSec = seconds(single[1], single[2]);
  } else {
    return null;
  }

  // "rest 30 sec", "30 sec off", "30 sec rest"
  let restSec: number | null = null;
  const restA = t.match(new RegExp(`rest\\s*${NUM}\\s*${UNIT}\\b`));
  const restB = t.match(new RegExp(`${NUM}\\s*${UNIT}\\s*(?:off|rest)\\b`));
  if (restA) restSec = seconds(restA[1], restA[2]);
  else if (restB) restSec = seconds(restB[1], restB[2]);

  // Nothing to time: no timer.
  if (workSec === null && restSec === null) return null;
  // One set has no rest to time either.
  if (sets === 1 && workSec === null) return null;
  if (!Number.isInteger(sets) || sets < 1 || sets > 20) return null;
  if (!within(workSec, 5, 1800) || !within(restSec, 5, 600)) return null;

  return { sets, workSec, restSec };
}

// A plan as one value. The timer starts again only when this changes: the
// screen behind it hands over a NEW object for the same drill every time a
// tick saves or the week is read again, and a timer that restarted on that
// jumped back to "Get ready" in the middle of a set (found Nov 26 2026).
export function planKey(plan: RepsPlan): string {
  return `${plan.sets}|${plan.workSec ?? "-"}|${plan.restSec ?? "-"}`;
}

function span(sec: number): string {
  if (sec % 60 === 0) return `${sec / 60} min`;
  if (sec > 60) return `${Math.floor(sec / 60)} min ${sec % 60} sec`;
  return `${sec} sec`;
}

// What the timer is about to run, in the coach's own numbers, shown under
// the short "Get ready" count so nobody reads that count as the set.
export function planLine(plan: RepsPlan): string {
  const sets = plan.sets === 1 ? "1 set" : `${plan.sets} sets`;
  const work = plan.workSec !== null ? `${sets} of ${span(plan.workSec)}` : sets;
  return plan.restSec !== null ? `${work}. Rest ${span(plan.restSec)}.` : `${work}.`;
}

export type TimerPhase =
  | "ready" // a few seconds to get set before a timed set
  | "work" // the set itself (timed, or waiting for "Set done")
  | "rest" // timed rest
  | "between" // set finished, no rest written: waiting for the next start
  | "done";

export type TimerStep = { phase: TimerPhase; set: number };

export const READY_SECONDS = 5;

export function timerStart(plan: RepsPlan): TimerStep {
  return { phase: plan.workSec !== null ? "ready" : "work", set: 1 };
}

// How long a step runs on the clock; null means it waits for a tap.
export function stepSeconds(plan: RepsPlan, step: TimerStep): number | null {
  if (step.phase === "ready") return READY_SECONDS;
  if (step.phase === "work") return plan.workSec;
  if (step.phase === "rest") return plan.restSec;
  return null;
}

export function timerNext(plan: RepsPlan, step: TimerStep): TimerStep {
  switch (step.phase) {
    case "ready":
      return { phase: "work", set: step.set };
    case "work":
      if (step.set >= plan.sets) return { phase: "done", set: plan.sets };
      return { phase: plan.restSec !== null ? "rest" : "between", set: step.set };
    case "rest":
    case "between":
      return { phase: "work", set: step.set + 1 };
    case "done":
      return step;
  }
}

// A rest is the player's to cut short, and so is the short "Get ready"
// count (Coach Yinka, Nov 26 2026: "allow them to skip the rest period").
// One button, the same words on the website and in the iPhone app; null
// means this step has nothing to skip.
export const SKIP_REST = "Skip rest";
export const START_NOW = "Start now";
export function skipLabel(step: TimerStep): string | null {
  if (step.phase === "rest") return SKIP_REST;
  if (step.phase === "ready") return START_NOW;
  return null;
}

// "0:47", "1:30"
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// The timer's sounds can be switched off on the Account page.
export const SOUND_PREF_KEY = "strive_sound";
