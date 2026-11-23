// Progress as the family sees it (offer stack item 8, Oct 12 2026): time
// trained, sessions done, weeks trained, minutes by pillar. Nothing here
// counts what was missed, and a gap of any length changes none of these
// numbers. The rules are the ones computeSummary (lib/elite/data.ts)
// already uses for the coach - a session is done when every drill in it
// is checked off, a drill with no minutes counts 15 - so the coach's
// numbers and the family's numbers never disagree.
import type { Homework } from "./types";

export const DEFAULT_DRILL_MIN = 15;

export type PillarMinutes = { pillar: string; minutes: number };

export type TimeTrained = {
  minutes: number; // every completed drill, every week, extras included
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
    const m = h.duration_min ?? DEFAULT_DRILL_MIN;
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
    .reduce((s, h) => s + (h.duration_min ?? DEFAULT_DRILL_MIN), 0);
}

// "4h 20m" / "45m" / "0m" - the one way time trained is written anywhere
// a player or parent sees it.
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
    const m = h.duration_min ?? DEFAULT_DRILL_MIN;
    const a = areas.get(area) ?? { area, minutes: 0, thisWeek: 0 };
    a.minutes += m;
    if (h.week === week) a.thisWeek += m;
    areas.set(area, a);
  }
  return [...areas.values()].sort((a, b) => b.minutes - a.minutes || a.area.localeCompare(b.area));
}
