// A week is announced to a family once. Ever.
//
// "Announced" = the in-app note, the email, the push and the parent
// report that go out for a week that has gone live (from 4:00 PM New York,
// see WEEK_ANNOUNCE_FROM_HOUR below). Before any of them is sent, the caller inserts a row into
// elite_week_announcements (player_id, week), whose primary key is that
// pair (migration 066). Only the caller whose insert succeeds may send.
// A rebuild, a second cron instance, a retry or a bug that publishes the
// same week again hits the key and sends nothing.
//
// Nov 12 2026: a cached database read made the hourly builder rebuild a
// live week every hour and text the family each time (117 times for one
// profile). The read is fixed; this is the lock that does not depend on
// any read being right.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AnnounceClaim = "claimed" | "already" | "failed";

// 23505 = unique_violation: this player's week is already on the ledger.
export function claimOutcome(error: { code?: string | null } | null | undefined): AnnounceClaim {
  if (!error) return "claimed";
  return error.code === "23505" ? "already" : "failed";
}

// Only a fresh claim may send. "failed" (the ledger could not be
// written) sends nothing either: a text that cannot be recorded as sent
// is a text that can repeat.
export function maySend(claim: AnnounceClaim): boolean {
  return claim === "claimed";
}

export async function claimWeekAnnouncement(
  client: SupabaseClient,
  playerId: string,
  week: number
): Promise<AnnounceClaim> {
  try {
    const { error } = await client
      .from("elite_week_announcements")
      .insert({ player_id: playerId, week });
    return claimOutcome(error);
  } catch {
    return "failed";
  }
}

export async function weekWasAnnounced(
  client: SupabaseClient,
  playerId: string,
  week: number
): Promise<boolean> {
  const { data } = await client
    .from("elite_week_announcements")
    .select("week")
    .eq("player_id", playerId)
    .eq("week", week)
    .maybeSingle();
  return Boolean(data);
}

// WHEN a new week is announced (Coach Yinka, Nov 24 2026: "lets not send
// notis at 6 am", "dont text parents either", "4 pm is fine").
//
// A week OPENS early Monday (time.ts unlockInstant), so a player who opens
// the app before school sees it. It is ANNOUNCED (the bell note, the
// notification, the email) from 4:00 PM New York, after school, when a
// player can start Session 1, and never after 9:00 PM. The same window
// holds for a week that goes live at any other moment (a first week, a
// catch-up): built at 11 PM, it is announced at 4 PM the next day. Nobody
// is texted about a new week: the parent text was dropped with the early
// hour. (In winter the old "6 AM" was 5 AM: the unlock is a fixed instant.)
export const WEEK_ANNOUNCE_FROM_HOUR = 16;
export const WEEK_ANNOUNCE_UNTIL_HOUR = 21;

// `hour` is the hour of the New York clock, 0 to 23.
export function weekAnnounceOpen(hour: number): boolean {
  return hour >= WEEK_ANNOUNCE_FROM_HOUR && hour < WEEK_ANNOUNCE_UNTIL_HOUR;
}

// A week that is open but not announced yet: its plan row is still waiting
// (notified false) and its opening time has passed. Between the opening
// and 4:00 PM this is the only mark that the week is live.
export async function weekIsLiveUnannounced(
  client: SupabaseClient,
  playerId: string,
  week: number
): Promise<boolean> {
  try {
    const { data } = await client
      .from("elite_weekly_plans")
      .select("week")
      .eq("player_id", playerId)
      .eq("week", week)
      .eq("notified", false)
      .lte("unlocks_at", new Date().toISOString())
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

// A week that is already live is never rebuilt: rebuilding deletes its
// drills, and with them every checkmark the player has earned. The one
// exception is a week whose drills are genuinely gone (cleared by hand),
// which may be built again, silently. `announced` is true for a week on
// the ledger AND for one that is open and waiting for its announcement
// (weekIsLiveUnannounced): the player may have trained in it either way.
export function mustRefuseRebuild(opts: { announced: boolean; drillsInWeek: number }): boolean {
  return opts.announced && opts.drillsInWeek > 0;
}
