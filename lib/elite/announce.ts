// A week is announced to a family once. Ever.
//
// "Announced" = the in-app note, the email, the push, the "week N just
// went live" text and the parent report that go out when a week goes
// live. Before any of them is sent, the caller inserts a row into
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

// A week that is already live is never rebuilt: rebuilding deletes its
// drills, and with them every checkmark the player has earned. The one
// exception is a week whose drills are genuinely gone (cleared by hand),
// which may be built again, silently.
export function mustRefuseRebuild(opts: { announced: boolean; drillsInWeek: number }): boolean {
  return opts.announced && opts.drillsInWeek > 0;
}
