// The session as the player works through it: the pure rules behind the
// session player, the home card and the week list (Nov 18 2026).
//
// One place decides what kind of drill a row is, what it is called on
// screen, how far through a session the player is and which drill comes
// next, so the three views can never disagree. Minutes use the same rule
// as time trained (a drill with no minutes counts 15), so the "+38 min"
// a player sees when a session ends is exactly what lands on their total.
import type { Homework } from "./types";
import { DEFAULT_DRILL_MIN } from "./time-trained";

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

export function drillMinutes(h: Pick<Homework, "duration_min">): number {
  return h.duration_min ?? DEFAULT_DRILL_MIN;
}

export type DoneMap = Record<string, boolean | undefined>;

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

export function sessionProgress(drills: Homework[], done: DoneMap): SessionProgress {
  let count = 0;
  let minutesDone = 0;
  let minutesTotal = 0;
  let nextIndex = -1;
  drills.forEach((d, i) => {
    const m = drillMinutes(d);
    minutesTotal += m;
    if (isDone(d, done)) {
      count++;
      minutesDone += m;
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

// What the finish screen says comes next. Never a nag, never a count of
// what is left undone beyond the plain fact.
export function afterSessionLine(sessionsLeft: number): string {
  if (sessionsLeft <= 0) return "That was the last session of the week.";
  if (sessionsLeft === 1) return "One session left this week. It is there when you are.";
  return `${sessionsLeft} sessions left this week. The next one is there when you are.`;
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
