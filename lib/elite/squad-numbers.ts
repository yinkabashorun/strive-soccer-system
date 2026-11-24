// The numbers the app is built to move (Nov 24 2026, Coach Yinka:
// "structure the app with purpose and variables that lead to instant and
// long term success").
//
// PURPOSE: a player opens the app, trains, and sees proof they are getting
// better (docs/product-principles.md, "the one idea").
//
// Seven numbers say whether that is happening, in two groups:
//
//   THE FIRST WEEK (instant success)
//     started        did at least one drill
//     firstSession   finished a whole session
//     firstWeek      finished a whole week
//   EVERY WEEK (long-term success)
//     thisWeek       sessions finished this week, against the plan
//     weeksTrained   weeks with training in them, out of weeks as a member
//     proof          has a first clip and a later one to set beside it
//     staying        still a member 4, 8 and 12 weeks after starting
//
// Every number is counted from what the app already stores (drills ticked
// off, progress clips, the membership), never estimated. This file is the
// one place they are worked out: pure, no database, tested in
// tests/squad-numbers.test.ts. The coach dashboard shows them
// (components/elite/SquadNumbersCard.tsx); nothing here is shown to a
// player or a parent, so nothing here ranks or shames anyone.
import { daysBetween } from "./breaks";
import { nyDateOf } from "./reminders";
import { featureOn } from "./tiers";

export type NumbersRow = {
  week: number;
  session?: number | null;
  is_extra?: boolean | null;
  completed: boolean;
  completed_at: string | null;
};

export type NumbersPlayer = {
  id: string;
  name: string;
  member: boolean; // membership active or trialing
  tier: string | null;
  startDay: string | null; // NY date their program clock started
  liveWeek: number; // the week they are in today
  onBreak: boolean;
  rows: NumbersRow[];
  clipWeeks: number[]; // weeks they sent a progress clip
};

export type Count = { n: number; of: number };
export type Flag = { id: string; name: string; reason: string };

export type SquadNumbers = {
  members: number;
  started: Count & { typicalDays: number | null };
  firstSession: Count;
  firstWeek: Count;
  thisWeekSessions: Count;
  thisWeekPlayers: Count;
  weeksTrained: Count;
  proof: Count;
  staying: { week: number; n: number; of: number }[];
  flags: Flag[];
};

export const STAY_MARKS = [4, 8, 12] as const;
export const QUIET_DAYS = 7; // no training for this long is worth a look
export const NOT_STARTED_DAYS = 2; // week 1 live this long with nothing done

// A session is finished when every drill in it is ticked off: the rule
// timeTrained() and the coach's summary already use.
function sessionsOf(rows: NumbersRow[]): Map<string, { week: number; extra: boolean; total: number; done: number }> {
  const out = new Map<string, { week: number; extra: boolean; total: number; done: number }>();
  for (const r of rows) {
    const key = `${r.week}:${r.session ?? 1}`;
    const s = out.get(key) ?? { week: r.week, extra: Boolean(r.is_extra), total: 0, done: 0 };
    s.total++;
    if (r.completed) s.done++;
    out.set(key, s);
  }
  return out;
}

function firstCompletion(rows: NumbersRow[]): string | null {
  let first: string | null = null;
  for (const r of rows) if (r.completed && r.completed_at && (!first || r.completed_at < first)) first = r.completed_at;
  return first;
}

function lastCompletion(rows: NumbersRow[]): string | null {
  let last: string | null = null;
  for (const r of rows) if (r.completed && r.completed_at && (!last || r.completed_at > last)) last = r.completed_at;
  return last;
}

// The middle value; an even count takes the lower of the two middles, so
// the figure is always one a real player had.
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

// The calendar week of the program a start date puts today in.
export function calendarWeek(startDay: string, today: string): number {
  return Math.max(1, Math.floor(daysBetween(startDay, today) / 7) + 1);
}

const first = (name: string) => name.trim().split(/\s+/)[0] || "A player";

export function squadNumbers(everyone: NumbersPlayer[], today: string): SquadNumbers {
  const members = everyone.filter((p) => p.member);
  // "Begun": their first week is live, so there is something to do.
  const begun = members.filter((p) => p.startDay !== null && p.startDay <= today);

  const started = begun.filter((p) => p.rows.some((r) => r.completed));
  const waits: number[] = [];
  for (const p of started) {
    const iso = firstCompletion(p.rows);
    const day = iso ? nyDateOf(iso) : null;
    if (day && p.startDay) waits.push(Math.max(0, daysBetween(p.startDay, day)));
  }

  const firstSession = begun.filter((p) => [...sessionsOf(p.rows).values()].some((s) => s.total > 0 && s.done === s.total));

  // A whole week: every planned drill of that week ticked off. Extra work
  // is on top of the plan and is not needed for it.
  const pastWeekOne = begun.filter((p) => p.liveWeek >= 2);
  const wholeWeek = (p: NumbersPlayer) => {
    const byWeek = new Map<number, { total: number; done: number }>();
    for (const r of p.rows) {
      if (r.is_extra) continue;
      const w = byWeek.get(r.week) ?? { total: 0, done: 0 };
      w.total++;
      if (r.completed) w.done++;
      byWeek.set(r.week, w);
    }
    return [...byWeek.values()].some((w) => w.total > 0 && w.done === w.total);
  };
  const firstWeek = pastWeekOne.filter(wholeWeek);

  // This week, for everyone who is training (a player on a break is owed
  // nothing and is left out of both sides).
  const training = begun.filter((p) => !p.onBreak);
  let planned = 0;
  let finished = 0;
  let trainedThisWeek = 0;
  for (const p of training) {
    const live = p.rows.filter((r) => r.week === p.liveWeek);
    for (const s of sessionsOf(live.filter((r) => !r.is_extra)).values()) {
      planned++;
      if (s.total > 0 && s.done === s.total) finished++;
    }
    if (live.some((r) => r.completed)) trainedThisWeek++;
  }

  // Weeks with training in them, out of the weeks each member has had.
  let weeksHad = 0;
  let weeksTrained = 0;
  for (const p of begun) {
    weeksHad += p.liveWeek;
    weeksTrained += new Set(p.rows.filter((r) => r.completed && r.week <= p.liveWeek).map((r) => r.week)).size;
  }

  // Proof: a first clip and a later one. Only for memberships that have
  // the progress video, and only once there has been time for a second.
  const clipDue = begun.filter((p) => featureOn(p.tier, "progressVideo") && p.liveWeek >= 3);
  const proof = clipDue.filter((p) => new Set(p.clipWeeks).size >= 2);

  // Staying: of everyone who started at least N weeks ago, how many are
  // still members. (An account that was deleted is gone from the database
  // and so from this count.)
  const everStarted = everyone.filter((p) => p.startDay !== null && p.startDay <= today);
  const staying = STAY_MARKS.map((week) => {
    const reached = everStarted.filter((p) => calendarWeek(p.startDay as string, today) >= week);
    return { week, n: reached.filter((p) => p.member).length, of: reached.length };
  });

  // Who each number is pointing at, most urgent first.
  const notStarted: (Flag & { days: number })[] = [];
  const quiet: (Flag & { days: number })[] = [];
  const noClip: Flag[] = [];
  for (const p of training) {
    const last = lastCompletion(p.rows);
    if (!last) {
      const days = daysBetween(p.startDay as string, today);
      if (days >= NOT_STARTED_DAYS) {
        notStarted.push({ id: p.id, name: p.name, days, reason: `${first(p.name)} has not started. Week 1 has been live for ${days} days.` });
      }
      continue;
    }
    const lastDay = nyDateOf(last);
    const days = lastDay ? daysBetween(lastDay, today) : 0;
    if (days >= QUIET_DAYS) {
      quiet.push({ id: p.id, name: p.name, days, reason: `${first(p.name)} has not trained for ${days} days.` });
    } else if (featureOn(p.tier, "progressVideo") && p.liveWeek >= 2 && p.clipWeeks.length === 0) {
      noClip.push({ id: p.id, name: p.name, reason: `${first(p.name)} is training but has not filmed a first clip.` });
    }
  }
  const byDays = (a: { days: number; name: string }, b: { days: number; name: string }) => b.days - a.days || a.name.localeCompare(b.name);
  const flags: Flag[] = [
    ...notStarted.sort(byDays).map(({ id, name, reason }) => ({ id, name, reason })),
    ...quiet.sort(byDays).map(({ id, name, reason }) => ({ id, name, reason })),
    ...noClip.sort((a, b) => a.name.localeCompare(b.name)),
  ];

  return {
    members: members.length,
    started: { n: started.length, of: begun.length, typicalDays: median(waits) },
    firstSession: { n: firstSession.length, of: begun.length },
    firstWeek: { n: firstWeek.length, of: pastWeekOne.length },
    thisWeekSessions: { n: finished, of: planned },
    thisWeekPlayers: { n: trainedThisWeek, of: training.length },
    weeksTrained: { n: weeksTrained, of: weeksHad },
    proof: { n: proof.length, of: clipDue.length },
    staying,
    flags,
  };
}

// "3 of 4", or a dash when there is nobody to count yet.
export function fmtCount(c: Count): string {
  return c.of === 0 ? "-" : `${c.n} of ${c.of}`;
}

// How long a new member typically takes to do their first drill.
export function fmtWait(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "Typically the same day their week goes live.";
  if (days === 1) return "Typically the day after their week goes live.";
  return `Typically ${days} days after their week goes live.`;
}
