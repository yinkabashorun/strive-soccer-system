// A player's first week is built by one caller at a time (migration 079).
//
// The first week can be asked for twice at once: the building screen after
// the quiz (buildFirstWeekFor) and the hourly builder, or the same screen
// reloaded. A build replaces the week's drills (delete, then insert), and
// before the week is announced nothing else stops two builds interleaving
// into a week with every drill twice. So before building a player's FIRST
// week every caller takes this claim, one row per player:
//
//   claimed      this caller inserted the row (or took over one that was
//                finished or stale): it builds, then calls release
//   held         another build holds it right now: build nothing
//   unavailable  the claim table could not be reached: build as before
//                (the hourly builder is never blocked by a missing table)
//
// Both paths go through runAutoWeeklyPlans (lib/elite/auto-plan.ts), which
// takes the claim whenever the player has no built week yet.
import type { SupabaseClient } from "@supabase/supabase-js";

export const FIRST_WEEK_CLAIM_TABLE = "elite_first_week_builds";

// A claim with no finished_at older than this was left by a build that
// crashed or timed out (the builder route's own limit is 300 s).
export const FIRST_WEEK_CLAIM_STALE_MS = 5 * 60 * 1000;

export type FirstWeekClaim = "claimed" | "held" | "unavailable";

export type ClaimRow = { started_at: string; finished_at: string | null };

// Whether a claim someone else inserted may be taken over: its build has
// finished (built or not), or it has run past the stale limit.
export function claimTakeable(row: ClaimRow | null | undefined, now: number): boolean {
  if (!row) return true;
  if (row.finished_at) return true;
  const started = Date.parse(row.started_at);
  if (!Number.isFinite(started)) return true;
  return now - started > FIRST_WEEK_CLAIM_STALE_MS;
}

// 23505 = unique_violation: another caller holds or held the row.
export function insertOutcome(error: { code?: string | null } | null | undefined): "claimed" | "conflict" | "unavailable" {
  if (!error) return "claimed";
  return error.code === "23505" ? "conflict" : "unavailable";
}

export async function claimFirstWeek(client: SupabaseClient, playerId: string, now = Date.now()): Promise<FirstWeekClaim> {
  try {
    const startedAt = new Date(now).toISOString();
    const { error } = await client.from(FIRST_WEEK_CLAIM_TABLE).insert({ player_id: playerId, started_at: startedAt });
    const outcome = insertOutcome(error);
    if (outcome !== "conflict") return outcome;

    const { data: row, error: readError } = await client
      .from(FIRST_WEEK_CLAIM_TABLE)
      .select("started_at, finished_at")
      .eq("player_id", playerId)
      .maybeSingle();
    if (readError) return "unavailable";
    if (!claimTakeable(row as ClaimRow | null, now)) return "held";
    if (!row) return "held"; // deleted between the insert and the read: let the next run take it

    // Take it over only if nobody else did since it was read: the update
    // matches the very started_at that was read.
    let update = client
      .from(FIRST_WEEK_CLAIM_TABLE)
      .update({ started_at: startedAt, finished_at: null })
      .eq("player_id", playerId)
      .eq("started_at", (row as ClaimRow).started_at);
    update = (row as ClaimRow).finished_at ? update.eq("finished_at", (row as ClaimRow).finished_at) : update.is("finished_at", null);
    const { data: taken, error: updateError } = await update.select("player_id");
    if (updateError) return "unavailable";
    return taken && taken.length > 0 ? "claimed" : "held";
  } catch {
    return "unavailable";
  }
}

// The build ended, built or not: a later caller may take the row over.
export async function releaseFirstWeek(client: SupabaseClient, playerId: string): Promise<void> {
  try {
    await client.from(FIRST_WEEK_CLAIM_TABLE).update({ finished_at: new Date().toISOString() }).eq("player_id", playerId);
  } catch {
    // Unreleased, the claim goes stale after FIRST_WEEK_CLAIM_STALE_MS.
  }
}

// What the builder logs for a player whose first week another build holds.
export const FIRST_WEEK_HELD = "first week being built by another run";
