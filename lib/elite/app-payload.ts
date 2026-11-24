// What the native iPhone app (mobile/) is sent, as pure functions of the
// same rows the web member pages read (Nov 23 2026).
//
// Every number and every line is worked out here from the shared rules
// (session-flow.ts, experience.ts, home.ts, time-trained.ts), never by the
// phone and never twice: the web Home and the app Home read the same week,
// the same next-week line, the same goal ladder. The phone only adds what
// a tap changes (a drill done) on top of this, optimistically, until the
// next fetch says the same.
import type { Achievement, Homework, TrainingBreak, WeeklyPlan } from "./types";
import {
  drillKind,
  drillMinutes,
  drillName,
  groupSessions,
  KIND_LABEL,
  oneMoreLine,
  planSessionCount,
  planSessionsLeft,
  lastWeekLine,
  sessionName,
  sessionProgress,
  type DrillKind,
} from "./session-flow";
import {
  cardName,
  cardTierLabel,
  hoursMedals,
  memberSinceLabel,
  mondayOfProgramWeek,
  nextMilestone,
  sessionHeadline,
  sessionImage,
  weekRange,
  weeklyMinutes,
} from "./experience";
import { drillPoster } from "./drill-poster";
import { goalLadder, type LadderRung } from "./home";
import { creditedMinutes, timeByArea, timeTrained, type AreaMinutes } from "./time-trained";
import { fmtMonday, liveWeekFor } from "./time";
import { fmtBreakDate } from "./breaks";
import { sessionsWord } from "./training";

// A clip or a still served from our own site is written as a path
// ("/drills/x.mp4"); the phone needs the whole address. Only https
// addresses and same-site paths are passed on.
export function absoluteMedia(src: string | null | undefined, base: string): string | null {
  if (typeof src !== "string") return null;
  const s = src.trim();
  if (!s) return null;
  if (s.startsWith("/") && !s.startsWith("//")) return base.replace(/\/+$/, "") + s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export type AppDrill = {
  id: string;
  title: string;
  name: string;
  kind: DrillKind;
  kindLabel: string;
  reps: string;
  how: string;
  notes: string | null;
  // the minutes the plan gives the drill
  minutes: number;
  // the actual minutes it added once done (0 until then): lib/elite/time-trained.ts
  trained: number;
  video: string | null;
  poster: string | null;
  completed: boolean;
};

export type AppSession = {
  n: number;
  name: string;
  extra: boolean;
  headline: string | null;
  image: string | null;
  minutesTotal: number;
  done: number;
  total: number;
  complete: boolean;
  drills: AppDrill[];
};

export type AppWeek = {
  // The week being trained: the live calendar week, or the latest built
  // week while the coach is behind. 0 when nothing is built yet.
  week: number;
  range: string | null;
  focus: string | null;
  sessions: AppSession[];
  // The first plan session with a drill still to do, or null.
  current: number | null;
  planCount: number;
  sessionsLeft: number;
  weekDone: boolean;
  oneMore: string | null;
  nextWeekLine: string;
  dropLine: string;
  // the week before, in one line, or null when there is nothing to say
  lastWeekLine: string | null;
  ladder: LadderRung[];
  totalMinutes: number;
  onBreak: { until: string; line: string } | null;
  hasWall: boolean;
};

function appDrill(h: Homework, base: string): AppDrill {
  const kind = drillKind(h.title);
  return {
    id: h.id,
    title: h.title,
    name: drillName(h.title),
    kind,
    kindLabel: KIND_LABEL[kind],
    reps: h.reps ?? "",
    how: h.exercise ?? "",
    notes: h.notes ?? null,
    minutes: drillMinutes(h),
    trained: creditedMinutes(h),
    video: absoluteMedia(h.video_url, base),
    poster: absoluteMedia(drillPoster(h.video_url), base),
    completed: Boolean(h.completed),
  };
}

// What Home says about next week: never a false "it's ready". The same
// words as the web Home.
export function nextWeekLine(i: {
  plans: Pick<WeeklyPlan, "week" | "unlocks_at">[];
  week: number;
  live: number;
  maxBuilt: number;
  now: number;
  nextMonday: string;
}): string {
  const scheduled = i.plans.find(
    (p) => p.week > i.week && p.unlocks_at && new Date(p.unlocks_at).getTime() > i.now
  );
  if (scheduled) return `Week ${scheduled.week} unlocks ${fmtMonday(i.nextMonday)}.`;
  if (i.maxBuilt < i.live) return `Your coach is building week ${i.live}. It lands the moment it's ready.`;
  return `Your coach is building week ${i.live + 1}. It drops Monday.`;
}

export function weekPayload(i: {
  homework: Homework[];
  week1Monday: string | null | undefined;
  currentWeek: number | null | undefined;
  plans: Pick<WeeklyPlan, "week" | "unlocks_at" | "focus">[];
  programGoal: string | null;
  onboardingGoal: string | null;
  focusName: string | null;
  onBreak: Pick<TrainingBreak, "until"> | null;
  hasWall: boolean;
  base: string;
  now: number;
  nextMonday: string;
}): AppWeek {
  const live = liveWeekFor(i.week1Monday, i.currentWeek ?? undefined);
  const maxBuilt = i.homework.reduce((m, h) => Math.max(m, h.week), 0);
  const week = maxBuilt > 0 ? Math.max(1, Math.min(live, maxBuilt)) : 0;
  // Only unlocked weeks exist for the player.
  const unlocked = i.homework.filter((h) => h.week <= live);
  const rows = unlocked.filter((h) => h.week === week);
  const groups = groupSessions(rows);
  const sessions: AppSession[] = groups.map((g) => {
    const p = sessionProgress(g.list, {});
    return {
      n: g.n,
      name: sessionName(g),
      extra: g.extra,
      headline: sessionHeadline(g.list),
      image: absoluteMedia(sessionImage(g.list), i.base),
      minutesTotal: p.minutesTotal,
      done: p.done,
      total: p.total,
      complete: p.complete,
      drills: g.list.map((h) => appDrill(h, i.base)),
    };
  });
  const current = groups.find((g) => g.list.some((h) => !h.completed))?.n ?? null;
  const left = planSessionsLeft(groups, {});
  const planCount = planSessionCount(groups);
  const plan = i.plans.find((p) => p.week === week);
  const count = sessionsWord(planCount);
  return {
    week,
    range: week > 0 ? weekRange(mondayOfProgramWeek(i.week1Monday, week)) : null,
    focus: plan?.focus?.trim() || null,
    sessions,
    current,
    planCount,
    sessionsLeft: left,
    weekDone: sessions.length > 0 && current === null,
    oneMore: oneMoreLine(left),
    nextWeekLine: nextWeekLine({ plans: i.plans, week, live, maxBuilt, now: i.now, nextMonday: i.nextMonday }),
    dropLine: `${count.charAt(0).toUpperCase()}${count.slice(1)} sessions. ${
      plan?.focus?.trim() || "Built from your answers and how your training goes."
    }`,
    lastWeekLine: lastWeekLine(unlocked, week),
    ladder: goalLadder({
      programGoal: i.programGoal,
      onboardingGoal: i.onboardingGoal,
      focusName: i.focusName,
      sessionsDone: planCount - left,
      sessionsTotal: planCount,
    }),
    totalMinutes: timeTrained(unlocked).minutes,
    onBreak: i.onBreak ? { until: i.onBreak.until, line: `On a break until ${fmtBreakDate(i.onBreak.until)}` } : null,
    hasWall: i.hasWall,
  };
}

export type AppYou = {
  card: { name: string; since: string | null; tier: string };
  position: string | null;
  week: number;
  weekMinutesDone: number;
  weekMinutesPlanned: number;
  allTimeMinutes: number;
  sessionsDone: number;
  bars: { week: number; minutes: number }[];
  areas: AreaMinutes[];
  medals: { hours: number; earned: boolean }[];
  next: { hours: number; minutesAway: number } | null;
  achievements: { id: string; title: string; detail: string }[];
  // An earned month of Strive Pro that is running (squad-pass.ts): the line
  // saying when it runs to, and the way to keep the weeks coming after it.
  earned?: { line: string; parent: { label: string; text: string } | null };
};

export function youPayload(i: {
  fullName: string;
  joinedAt: string | null | undefined;
  tier: string | null | undefined;
  position: string | null | undefined;
  homework: Homework[];
  achievements: Pick<Achievement, "id" | "title" | "detail">[];
  week1Monday: string | null | undefined;
  currentWeek: number | null | undefined;
}): AppYou {
  const live = liveWeekFor(i.week1Monday, i.currentWeek ?? undefined);
  const maxBuilt = i.homework.reduce((m, h) => Math.max(m, h.week), 0);
  const week = Math.max(1, Math.min(live, maxBuilt || 1));
  const unlocked = i.homework.filter((h) => h.week <= live);
  const time = timeTrained(unlocked);
  const thisWeek = i.homework.filter((h) => h.week === week);
  // planned is the plan; done is the actual time of what is done
  const planned = thisWeek.reduce((s, h) => s + drillMinutes(h), 0);
  const done = thisWeek.reduce((s, h) => s + creditedMinutes(h), 0);
  return {
    card: { name: cardName(i.fullName), since: memberSinceLabel(i.joinedAt), tier: cardTierLabel(i.tier) },
    position: i.position?.trim() || null,
    week,
    weekMinutesDone: done,
    weekMinutesPlanned: planned,
    allTimeMinutes: time.minutes,
    sessionsDone: time.sessions,
    bars: weeklyMinutes(i.homework, week, 7),
    areas: timeByArea(unlocked, week),
    medals: hoursMedals(time.minutes, 4),
    next: nextMilestone(time.minutes),
    achievements: i.achievements.map((a) => ({ id: a.id, title: a.title, detail: a.detail })),
  };
}
