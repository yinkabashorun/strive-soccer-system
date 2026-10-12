// Breaks from training (offer stack item 8, Oct 12 2026).
//
// A break is a date range on elite_training_breaks. While a player is on
// one, every automatic process leaves them alone: the hourly builder
// skips them, the live-week audit skips them, the Monday unlock and its
// texts wait, the parent recap returns null, the digest leaves them out.
// When the break ends, the program clock (elite_players.week1_monday)
// moves LATER by whole weeks so the week they come back to is the week
// they left - the one they were in if it still had work, otherwise the
// next one. The hourly catch-up then builds that week within the hour.
//
// resumeAnchor is the one rule, pure and unit-tested. settleBreaks
// applies it exactly once per break (resumed_at) from the two places a
// return is noticed first: the hourly builder and the family opening
// the app.
import type { SupabaseClient } from "@supabase/supabase-js";
import { liveWeekNumber, nyToday } from "./time";
import type { Homework, TrainingBreak } from "./types";

export const MAX_BREAK_DAYS = 90;

// 0 = Monday ... 6 = Sunday, for a YYYY-MM-DD string.
function mondayIndex(day: string): number {
  return (new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7;
}
export function shiftDays(day: string, delta: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 864e5
  );
}

// The break in effect on `today` (NY date), if any.
export function currentBreak(
  breaks: Pick<TrainingBreak, "since" | "until">[],
  today: string = nyToday()
): Pick<TrainingBreak, "since" | "until"> | null {
  return breaks.find((b) => b.since <= today && today <= b.until) ?? null;
}

export function isOnBreak(
  breaks: Pick<TrainingBreak, "since" | "until">[],
  today: string = nyToday()
): boolean {
  return currentBreak(breaks, today) !== null;
}

// Where the program clock should move when a break ends, or null when it
// should not move at all.
//   maxBuilt  = highest week the player has homework for
//   openWork  = that week still has an unfinished non-extra drill
//   today     = the NY date the return is being settled on
// Rules: never before the clock started (no week1Monday / no weeks), never
// backwards (the calendar is not behind the player), always by whole
// weeks. On a Sunday the target week starts tomorrow when it still has
// to be built, so the Sunday rule ("never a catch-up day") cannot leave
// it unbuilt.
export function resumeAnchor(opts: {
  week1Monday: string | null | undefined;
  maxBuilt: number;
  openWork: boolean;
  today: string;
}): string | null {
  const { week1Monday, maxBuilt, openWork, today } = opts;
  if (!week1Monday || maxBuilt < 1) return null;
  const target = openWork ? maxBuilt : maxBuilt + 1;
  const thisMonday = shiftDays(today, -mondayIndex(today));
  const liveNow = Math.max(1, Math.floor(daysBetween(week1Monday, thisMonday) / 7) + 1);
  if (liveNow <= target) return null;
  const sunday = mondayIndex(today) === 6;
  const startMonday = sunday && !openWork ? shiftDays(thisMonday, 7) : thisMonday;
  return shiftDays(startMonday, -(target - 1) * 7);
}

// Has this week any unfinished drill the plan assigned (extras don't hold
// a player back: they were a bonus)?
export function weekHasOpenWork(rows: Pick<Homework, "week" | "completed" | "is_extra">[], week: number): boolean {
  return rows.some((r) => r.week === week && !r.completed && !r.is_extra);
}

export type SettleResult = { settled: number; week1Monday: string | null | undefined };

// Settle every ended-but-unsettled break for one player: move the clock
// once, stamp resumed_at. Idempotent; safe to call from anywhere with a
// service client. Returns the (possibly new) week1_monday so callers can
// keep working with a correct live week in the same run.
export async function settleBreaks(
  admin: SupabaseClient,
  player: { id: string; week1_monday?: string | null },
  today: string = nyToday()
): Promise<SettleResult> {
  const { data } = await admin
    .from("elite_training_breaks")
    .select("id, since, until")
    .eq("player_id", player.id)
    .is("resumed_at", null)
    .lt("until", today)
    .order("until", { ascending: true });
  const due = (data as Pick<TrainingBreak, "id" | "since" | "until">[] | null) ?? [];
  if (due.length === 0) return { settled: 0, week1Monday: player.week1_monday };

  const { data: hw } = await admin
    .from("elite_homework")
    .select("week, completed, is_extra")
    .eq("player_id", player.id);
  const rows = (hw as Pick<Homework, "week" | "completed" | "is_extra">[] | null) ?? [];
  const maxBuilt = rows.reduce((m, r) => Math.max(m, r.week), 0);
  const anchor = resumeAnchor({
    week1Monday: player.week1_monday,
    maxBuilt,
    openWork: weekHasOpenWork(rows, maxBuilt),
    today,
  });
  let week1Monday = player.week1_monday;
  if (anchor) {
    const { error } = await admin
      .from("elite_players")
      .update({ week1_monday: anchor, current_week: liveWeekNumber(anchor) })
      .eq("id", player.id);
    if (!error) week1Monday = anchor;
  }
  await admin
    .from("elite_training_breaks")
    .update({ resumed_at: new Date().toISOString() })
    .in("id", due.map((b) => b.id));
  return { settled: due.length, week1Monday };
}

// Human line for the player and the coach: "On a break until Mon, Oct 20".
export function fmtBreakDate(day: string): string {
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

