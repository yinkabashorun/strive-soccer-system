// The session as the player works through it: the pure rules behind the
// session player, the home card and the week list (Nov 18 2026).
//
// One place decides what kind of drill a row is, what it is called on
// screen, how far through a session the player is and which drill comes
// next, so the three views can never disagree. Minutes use the same rule
// as time trained (a drill with no minutes counts 15), so the "+38 min"
// a player sees when a session ends is exactly what lands on their total.
import type { Homework } from "./types";
import { DEFAULT_DRILL_MIN, cappedSeconds, creditedMinutes, fmtDuration } from "./time-trained";
import { pickLine, seedDay } from "./voice";

export type DrillKind = "warmup" | "finisher" | "skill";

// The bank prefixes its two special kinds ("Plyo warm-up: ...",
// "Strength: ..."); everything else is a skill drill.
export function drillKind(title: string): DrillKind {
  const t = title.trim();
  if (/^strength(ening)?\b/i.test(t)) return "finisher";
  if (/plyo|warm-?up/i.test(t)) return "warmup";
  return "skill";
}

// The name without the bank's label, for a screen that already shows the
// kind as a badge ("Plyo warm-up: Pogo jumps" reads "Pogo jumps").
export function drillName(title: string): string {
  const t = title.trim();
  const stripped = t
    .replace(/^plyo\s+warm-?up\s*:\s*/i, "")
    .replace(/^strength(ening)?\s*:\s*/i, "");
  return stripped.length > 0 ? stripped : t;
}

export const KIND_LABEL: Record<DrillKind, string> = {
  warmup: "Warm-up",
  finisher: "Finisher",
  skill: "Drill",
};

// Send a clip is for skill drills only (the Oct 13 rule).
export function canSendClip(title: string): boolean {
  return drillKind(title) === "skill";
}

// The minutes the PLAN gives a drill (what a session card promises).
export function drillMinutes(h: Pick<Homework, "duration_min">): number {
  return h.duration_min ?? DEFAULT_DRILL_MIN;
}

export type DoneMap = Record<string, boolean | undefined>;

// Seconds measured on this device for drills ticked on it (the session
// player's own clock), by drill id.
export type TrainedMap = Record<string, number | undefined>;

// The ACTUAL minutes a drill adds, as the screen shows it right now: a
// drill ticked on this device counts the time just measured (capped by the
// same rule the server uses); one the server already holds counts what the
// server holds (lib/elite/time-trained.ts creditedMinutes).
export function doneMinutes(
  h: Pick<Homework, "id" | "completed" | "duration_min" | "actual_seconds">,
  done: DoneMap,
  trained: TrainedMap = {}
): number {
  if (!isDone(h, done)) return 0;
  const here = done[h.id] === true ? trained[h.id] : undefined;
  if (here !== undefined) return creditedMinutes({ completed: true, actual_seconds: cappedSeconds(here, drillMinutes(h)) });
  return creditedMinutes({ ...h, completed: true });
}

// A drill is done when the player's own tap says so; a drill the screen has
// no tap for yet reads what the server last said.
export function isDone(h: Pick<Homework, "id" | "completed">, done: DoneMap): boolean {
  return done[h.id] ?? h.completed;
}

export type SessionProgress = {
  total: number;
  done: number;
  complete: boolean;
  nextIndex: number; // first drill still to do, -1 when the session is complete
  minutesDone: number;
  minutesTotal: number;
};

// minutesTotal is the plan; minutesDone is the actual time of what is done.
export function sessionProgress(drills: Homework[], done: DoneMap, trained: TrainedMap = {}): SessionProgress {
  let count = 0;
  let minutesDone = 0;
  let minutesTotal = 0;
  let nextIndex = -1;
  drills.forEach((d, i) => {
    const m = drillMinutes(d);
    minutesTotal += m;
    if (isDone(d, done)) {
      count++;
      minutesDone += doneMinutes(d, done, trained);
    } else if (nextIndex === -1) {
      nextIndex = i;
    }
  });
  return {
    total: drills.length,
    done: count,
    complete: drills.length > 0 && count === drills.length,
    nextIndex,
    minutesDone,
    minutesTotal,
  };
}

// Where the player goes after finishing the drill at `from`: the next drill
// still to do further down the session, else the first one still to do
// above it, else -1 (the session is complete).
export function nextStep(drills: Homework[], done: DoneMap, from: number): number {
  for (let i = from + 1; i < drills.length; i++) if (!isDone(drills[i], done)) return i;
  for (let i = 0; i < from && i < drills.length; i++) if (!isDone(drills[i], done)) return i;
  return -1;
}

export type SessionGroup = { n: number; list: Homework[]; extra: boolean };

// One week's rows as its sessions, in order, each in drill order.
export function groupSessions(rows: Homework[]): SessionGroup[] {
  const by = new Map<number, Homework[]>();
  for (const h of rows) {
    const s = h.session ?? 1;
    by.set(s, [...(by.get(s) ?? []), h]);
  }
  return [...by.entries()]
    .map(([n, list]) => ({
      n,
      list: [...list].sort((a, b) => a.sort - b.sort),
      extra: list.some((h) => h.is_extra),
    }))
    .sort((a, b) => a.n - b.n);
}

// "Session 3" or "Extra session", the one name every view uses.
export function sessionName(group: Pick<SessionGroup, "n" | "extra">): string {
  return group.extra ? "Extra session" : `Session ${group.n}`;
}

// The plan sessions of a week still open: sessions with a drill not yet
// done, Extra work left out (an extra is on top of the week, never part of
// completing it). `except` leaves one session out (the one being finished).
export function planSessionsLeft(sessions: SessionGroup[], done: DoneMap, except?: number): number {
  return sessions.filter(
    (s) => !s.extra && s.n !== except && s.list.some((h) => !isDone(h, done))
  ).length;
}

export function planSessionCount(sessions: SessionGroup[]): number {
  return sessions.filter((s) => !s.extra).length;
}

// Said on Home and on the finish screen when exactly one plan session of
// the week is left; nothing at all otherwise (a complete week is never
// nagged, two or more left is not news).
export const ONE_MORE_LINE = "One more session completes your week.";
export function oneMoreLine(sessionsLeft: number): string | null {
  return sessionsLeft === 1 ? ONE_MORE_LINE : null;
}

// What the drop says about the week before, when there is something to
// say: the sessions finished (extras count, they were trained) and the time
// trained. A week with nothing trained says nothing at all; nothing here
// ever counts what was left undone.
export function lastWeekLine(rows: Homework[], week: number): string | null {
  if (week <= 1) return null;
  const last = rows.filter((h) => h.week === week - 1);
  const minutes = last.reduce((s, h) => s + creditedMinutes(h), 0);
  const finished = groupSessions(last).filter((g) => g.list.every((h) => h.completed)).length;
  if (finished > 0 && minutes > 0) {
    return `Last week you finished ${finished} ${finished === 1 ? "session" : "sessions"} and trained ${fmtDuration(minutes)}.`;
  }
  if (finished > 0) return `Last week you finished ${finished} ${finished === 1 ? "session" : "sessions"}.`;
  if (minutes > 0) return `Last week you trained ${fmtDuration(minutes)}.`;
  return null;
}

// The drop's one button: the first session of the week, by its own name.
export function dropStartLabel(first: Pick<SessionGroup, "n" | "extra"> | null): string {
  return first ? `Start ${sessionName(first).toLowerCase()}` : "Let's go";
}

// After a full week (the leaders' finding: players who train more than one
// kind of thing stay longer): the two ways to keep going, said once.
export const AFTER_WEEK_MORE = "Still want to train this week? Add extra work, or open a course.";

// What the finish screen says comes next. Never a nag, never a count of
// what is left undone beyond the plain fact.
export function afterSessionLine(sessionsLeft: number): string {
  if (sessionsLeft <= 0) return "That was the last session of the week.";
  if (sessionsLeft === 1) return ONE_MORE_LINE;
  return `${sessionsLeft} sessions left this week. The next one is there when you are.`;
}

// Milestones are hours trained, all time: a number that only ever goes up
// and that a break cannot touch. Never a streak, never a count of what was
// missed. Returns the highest milestone the minutes just trained carried
// the player past, or null (most sessions).
export const MILESTONE_HOURS = [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500];

export function milestoneCrossed(minutesBefore: number, minutesAfter: number): number | null {
  let hit: number | null = null;
  for (const h of MILESTONE_HOURS) {
    if (minutesBefore < h * 60 && minutesAfter >= h * 60) hit = h;
  }
  return hit;
}

export function milestoneLabel(hours: number): string {
  return hours === 1 ? "1 hour trained" : `${hours} hours trained`;
}

// The line under a medal just earned on the finish screen (the voice
// guide, moment 10): a mix, and personal, nobody else in it. Held still by
// the medal and the New York day. The iPhone app and the website say it
// from here.
export function milestoneEarnedLines(hours: number): string[] {
  const n = hours === 1 ? "1 hour" : `${hours} hours`;
  return ["Earned today. It stays yours.", "It stays yours. Just the beginning.", `${n} of work nobody made you do. That's the difference.`];
}
export function milestoneEarnedLine(hours: number, day: string = seedDay()): string {
  return pickLine(milestoneEarnedLines(hours), `medal:${hours}:${day}`);
}

// The feel of each moment, lightest to strongest. One ladder, used by the
// native shell's haptics and by the web fallback, so a single drill never
// buzzes like a finished week. It follows Apple's guidance: use each system
// haptic for its documented meaning (an impact for something landing, the
// success notification for a task completed), match the weight to the
// moment, and keep it rare: nothing on navigation, scrolling or undo.
export type Moment = "drill" | "session" | "week";

export type NativeHaptic = {
  method: "impact" | "notification";
  options: Record<string, string>;
  // Milliseconds to wait before this call (the week is two beats).
  after?: number;
};

export type Haptic = {
  // The native calls, in order (Capacitor Haptics plugin).
  native: NativeHaptic[];
  // The web fallback (navigator.vibrate), in milliseconds.
  pattern: number[];
};

export function hapticFor(moment: Moment): Haptic {
  switch (moment) {
    case "drill":
      return { native: [{ method: "impact", options: { style: "LIGHT" } }], pattern: [12] };
    case "session":
      return { native: [{ method: "notification", options: { type: "SUCCESS" } }], pattern: [18, 60, 28] };
    case "week":
      return {
        native: [
          { method: "impact", options: { style: "HEAVY" } },
          { method: "notification", options: { type: "SUCCESS" }, after: 380 },
        ],
        pattern: [30, 80, 18, 60, 28],
      };
  }
}

// One device-level switch for vibration (Apple: "make haptics optional"),
// kept on the phone, on by default.
export const FEEL_PREF_KEY = "strive_feel";
export function feelEnabled(stored: string | null): boolean {
  return stored !== "off";
}

// Drill demos play on their own, muted, unless the player switches that off
// on their Account page (Apple: never autoplay without a way to stop it).
export const AUTOPLAY_PREF_KEY = "strive_autoplay";
