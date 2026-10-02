// THE rule for which week a plan targets and when it goes live. Pure, no
// I/O, so it is unit-tested (tests/week-target.test.ts) and CI refuses any
// change that breaks it. Both callers - the coach's manual publish
// (coach-actions.ts applyGeneratedPlanCore) and the hourly builder
// (auto-plan.ts) - read from here, so they can never disagree again.
//
// Calendar model (America/New_York): a training week is Monday-Sunday.
//   first week   -> week 1, live now. Its clock anchors to this week's
//                   Monday, or NEXT Monday if today is Sunday, so week 1
//                   is never a one-day week.
//   behind       -> (live week has no plan, and it is NOT Sunday) the
//                   live week itself, live now. Missed weeks never existed.
//   otherwise    -> the week after the live one (or the already-scheduled
//                   pending week, which is replaced), held to Monday 6am.
//                   On Sunday this applies even when the live week was
//                   never built: Sunday is the eve of a new week, never a
//                   catch-up day. (Oct 1 2026: the old rule caught up the
//                   dying week on Sundays and left every player who had
//                   ever fallen behind permanently one week behind.)

export type WeekTargetInput = {
  firstWeek: boolean; // no week1_monday yet
  liveWeek: number; // from the calendar (liveWeekFor)
  maxBuilt: number; // highest week with homework, 0 if none
  sundayEve: boolean; // isSundayEveNY()
  pendingWeek?: number | null; // a scheduled, not-yet-unlocked week
};

export type WeekTarget = {
  week: number;
  goesLiveNow: boolean;
  mode: "first" | "catch_up" | "next";
  // Weeks to add to this week's Monday when anchoring a first week.
  anchorOffsetWeeks: 0 | 1;
};

export function resolveWeekTarget(i: WeekTargetInput): WeekTarget {
  const anchorOffsetWeeks = i.sundayEve ? 1 : 0;
  if (i.firstWeek) {
    return { week: 1, goesLiveNow: true, mode: "first", anchorOffsetWeeks };
  }
  if (i.maxBuilt < i.liveWeek && !i.sundayEve) {
    return { week: i.liveWeek, goesLiveNow: true, mode: "catch_up", anchorOffsetWeeks };
  }
  return {
    week: i.pendingWeek ?? i.liveWeek + 1,
    goesLiveNow: false,
    mode: "next",
    anchorOffsetWeeks,
  };
}

// What the hourly builder is responsible for having built, right now.
// Built through this week already -> nothing to do this run.
export function builderTargetWeek(i: {
  hasClock: boolean; // week1_monday set
  liveWeek: number;
  sundayEve: boolean;
}): number {
  if (!i.hasClock) return 1;
  return i.sundayEve ? i.liveWeek + 1 : i.liveWeek;
}
