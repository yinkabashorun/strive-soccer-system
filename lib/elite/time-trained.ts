// Progress as the family sees it (offer stack item 8, Oct 12 2026): time
// trained, sessions done, weeks trained, minutes by pillar. Nothing here
// counts what was missed, and a gap of any length changes none of these
// numbers. The rules are the ones computeSummary (lib/elite/data.ts)
// already uses for the coach - a session is done when every drill in it
// is checked off - so the coach's numbers and the family's numbers never
// disagree. Every drill row carries its own minutes: the column is required
// and has no default (migration 084), so DEFAULT_DRILL_MIN below is only
// ever met by a row read without that column, never by a stored drill.
import type { Homework } from "./types";

export const DEFAULT_DRILL_MIN = 15;

// Minutes that can be credited to a player: a whole number from 1 to 120.
// Anything else is "no minutes", and the writers (the publish gate, extra
// work) refuse it rather than put a figure in its place. The database holds
// the same line (migration 084).
export const MINUTES_MIN = 1;
export const MINUTES_MAX = 120;
export function realMinutes(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= MINUTES_MIN && v <= MINUTES_MAX ? v : null;
}

// ---------------------------------------------------------------------
// MINUTES TRAINED ARE THE ACTUAL MINUTES (Nov 24 2026, Coach Yinka:
// "Minutes trained should be ACTUAL minutes trained").
//
// The session player times each drill: from the moment it comes on screen
// to the tap on Done, on the phone and on the website. That measured time
// is stored on the drill's row (elite_homework.actual_seconds, migration
// 085) and is what every total here adds up: time trained, the week, the
// bars, time by area, the hours medals, the coach's numbers.
//
// Three rules, the same in the database (085):
//   - a drill counts the whole minutes it really took (rounded to the
//     nearest minute); one ticked off in a few seconds counts nothing
//   - one drill never counts more than ACTUAL_CAP_FACTOR times the minutes
//     the plan gives it, so a phone left open overnight is not five hours
//   - a drill finished BEFORE the app measured time (or from an app build
//     that does not send it) has no measured time. It keeps the minutes the
//     plan gave it: the only figure there is, and taking it away would make
//     a total go down, which nothing here ever does.
// The minutes written on a drill by the plan (duration_min) are now only
// the PLAN: "4 drills, 22 min" on a session card, the grey of the ring.
// ---------------------------------------------------------------------
export const ACTUAL_CAP_FACTOR = 2;

// The measured time that is kept for a drill: whole seconds, never under
// zero, never over the cap. null when nothing was measured.
export function cappedSeconds(seconds: unknown, plannedMinutes: number): number | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(Math.round(seconds), Math.max(1, plannedMinutes) * 60 * ACTUAL_CAP_FACTOR);
}

// Whole minutes for a measured time.
export function minutesOfSeconds(seconds: number): number {
  return Math.round(seconds / 60);
}

// THE one rule for what a drill adds to time trained.
export function creditedMinutes(h: { completed?: boolean | null; duration_min?: number | null; actual_seconds?: number | null }): number {
  if (!h.completed) return 0;
  if (typeof h.actual_seconds === "number") return minutesOfSeconds(h.actual_seconds);
  return h.duration_min ?? DEFAULT_DRILL_MIN;
}

export type PillarMinutes = { pillar: string; minutes: number };

export type TimeTrained = {
  minutes: number; // the actual minutes of every completed drill, every week, extras included
  sessions: number; // (week, session) groups with every drill completed
  weeks: number; // distinct weeks with at least one completed drill
  byPillar: PillarMinutes[]; // completed minutes per pillar, largest first
  lastActive: string | null; // ISO of the most recent completion
};

export function timeTrained(rows: Homework[]): TimeTrained {
  const completed = rows.filter((h) => h.completed);
  let minutes = 0;
  const weeks = new Set<number>();
  const pillars = new Map<string, number>();
  let lastActive: string | null = null;
  for (const h of completed) {
    const m = creditedMinutes(h);
    minutes += m;
    weeks.add(h.week);
    if (h.pillar) pillars.set(h.pillar, (pillars.get(h.pillar) ?? 0) + m);
    if (h.completed_at && (!lastActive || h.completed_at > lastActive)) lastActive = h.completed_at;
  }

  const bySession = new Map<string, { total: number; done: number }>();
  for (const h of rows) {
    const key = `${h.week}:${h.session ?? 1}`;
    const s = bySession.get(key) ?? { total: 0, done: 0 };
    s.total++;
    if (h.completed) s.done++;
    bySession.set(key, s);
  }
  let sessions = 0;
  for (const s of bySession.values()) if (s.total > 0 && s.done === s.total) sessions++;

  const byPillar = [...pillars.entries()]
    .map(([pillar, mins]) => ({ pillar, minutes: mins }))
    .sort((a, b) => b.minutes - a.minutes || a.pillar.localeCompare(b.pillar));

  return { minutes, sessions, weeks: weeks.size, byPillar, lastActive };
}

// Minutes of one week's completed drills (the week-complete card).
export function weekMinutes(rows: Homework[], week: number): number {
  return rows
    .filter((h) => h.week === week && h.completed)
    .reduce((s, h) => s + creditedMinutes(h), 0);
}

// "4h 20m" / "45m" / "0m" - the one way time trained is written anywhere
// a player or parent sees it.
// The line beside "Earned" on the You tab: how far the next hours medal is,
// said the way a player reads it ("1h 46m to your 5 hour medal"). It used to
// read "5 hours in 1h 46m", which nobody could parse (Coach Yinka, Nov 26 2026).
export function nextMedalLine(hours: number, minutesAway: number): string {
  return `${fmtDuration(minutesAway)} to your ${hours} hour medal`;
}

export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

// ---------------------------------------------------------------------
// Time by area (Nov 22 2026, Coach Yinka: "track time trained on the
// specific areas they were working on"). Every completed drill's minutes
// under the area it is filed under, in the player's words, with this
// week's share beside the all-time total. Only adds up, like every number
// here.
// ---------------------------------------------------------------------
export const AREA_NAMES: Record<string, string> = {
  "Ball Mastery": "Ball mastery",
  "Weak Foot": "Weak foot",
  Passing: "Passing",
  Confidence: "1v1 moves",
  Scanning: "Scanning",
  "Decision Making": "Decision making",
  Speed: "Speed",
  Shooting: "Shooting",
  Plyo: "Plyo warm-ups",
  Strengthening: "Strength",
};

export function areaName(pillar: string): string {
  return AREA_NAMES[pillar] ?? pillar;
}

export type AreaMinutes = { area: string; minutes: number; thisWeek: number };

export function timeByArea(rows: Homework[], week: number): AreaMinutes[] {
  const areas = new Map<string, AreaMinutes>();
  for (const h of rows) {
    if (!h.completed || !h.pillar) continue;
    const area = areaName(h.pillar);
    const m = creditedMinutes(h);
    const a = areas.get(area) ?? { area, minutes: 0, thisWeek: 0 };
    a.minutes += m;
    if (h.week === week) a.thisWeek += m;
    areas.set(area, a);
  }
  return [...areas.values()].sort((a, b) => b.minutes - a.minutes || a.area.localeCompare(b.area));
}
