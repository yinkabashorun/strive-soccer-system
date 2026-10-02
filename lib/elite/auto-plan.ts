// Fully automated weekly plan generation. Coach Yinka no longer writes a
// note or clicks approve for this to run - an hourly cron (see
// app/api/elite/cron/weekly-plans) calls runPlanBuilder() for every
// active, onboarded player. In place of a coach's typed session notes,
// the "notes" the AI sees are synthesized from what actually happened:
// last week's homework completion and the player's own self-checkin. The
// personalization promise in the copy ("I build every plan, I review every
// plan") stays as-is per CLAUDE.md - the backend changed, the copy didn't.
//
// WHAT A RUN BUILDS, by day (America/New_York):
//   Sunday (3pm ET slot only, gated in the route) - the week that starts
//     tomorrow, for every player, even one whose current week was never
//     built. Held until Monday 6am ET, then unlocked + announced.
//   Monday-Saturday, every hour - catch-up only: a player whose LIVE week
//     has no plan gets it right now. Nothing is pre-built mid-week, so in
//     the steady state these runs do nothing but prove the cron is alive.
//   A player with no first week yet gets week 1 on the next run, any day.
// This is what makes a failed Sunday run self-heal within the hour on
// Monday instead of leaving players on a stale week for seven days (which
// is exactly what happened Sept 27-Oct 1 2026).
//
// EVERY run leaves a row in elite_cron_runs and the coach dashboard shows
// the latest one. A run with errors, or one that could not run at all
// while players are waiting, texts + emails the coach (lib/elite/cron-log).
import { createServiceClient } from "./supabase/server";
import { generatePlanFromNotes } from "./ai-coach";
import { applyGeneratedPlanCore } from "./coach-actions";
import { getDrillBank, latestCoachingCallNotes } from "./data";
import { isSundayEveNY, liveWeekFor } from "./time";
import { alertCoach, PLAN_BUILDER_JOB, recordCronRun } from "./cron-log";
import type { Player } from "./types";

type Result =
  | { playerId: string; name: string; ok: true; skipped?: string; week?: number }
  | { playerId: string; name: string; ok: false; error: string };

export type PlanBuilderOutcome = {
  ran: number;
  built: number;
  skipped: number;
  errors: { name: string; error: string }[];
  results: Result[];
  // Set when the builder could not run at all (no DB, no coach profile).
  reason?: string;
};

function synthesizeNotes(
  homework: Array<{ title: string; completed: boolean }>,
  checkin?: { rating: number | null; energy: number | null; went_well: string; struggled: string; note: string }
): string {
  const parts: string[] = [];
  const done = homework.filter((h) => h.completed);
  const missed = homework.filter((h) => !h.completed);
  if (homework.length) {
    parts.push(`Completed ${done.length}/${homework.length} sessions last week.`);
    if (missed.length) parts.push(`Missed: ${missed.map((h) => h.title).join(", ")}.`);
  }
  if (checkin) {
    if (checkin.rating != null) parts.push(`Player rated the week ${checkin.rating}/5, energy ${checkin.energy ?? "n/a"}/5.`);
    if (checkin.went_well) parts.push(`What went well: ${checkin.went_well}`);
    if (checkin.struggled) parts.push(`What they struggled with: ${checkin.struggled}`);
    if (checkin.note) parts.push(`Player note: ${checkin.note}`);
  }
  if (!parts.length) {
    parts.push("No self-report yet. Keep progressing their known weaknesses and goals.");
  }
  return parts.join("\n");
}

export async function runAutoWeeklyPlans(): Promise<PlanBuilderOutcome> {
  const empty = (reason: string): PlanBuilderOutcome => ({
    ran: 0, built: 0, skipped: 0, errors: [], results: [], reason,
  });
  const admin = createServiceClient();
  if (!admin) return empty("no service client (SUPABASE_SERVICE_ROLE_KEY unset)");

  const { data: coach } = await admin
    .from("elite_profiles")
    .select("id")
    .in("role", ["coach", "admin"])
    .order("role")
    .limit(1)
    .maybeSingle();
  if (!coach?.id) return empty("no coach/admin profile to attribute plans to");

  const { data: players } = await admin
    .from("elite_players")
    .select("*")
    .not("onboarded_at", "is", null)
    .in("subscription_status", ["active", "trialing"]);
  const roster = (players as Player[] | null) ?? [];

  const { drills: bank } = await getDrillBank({ onlyWithVideo: true });
  const sundayEve = isSundayEveNY();
  const results: Result[] = [];

  for (const player of roster) {
    try {
      const liveWeek = liveWeekFor(player.week1_monday, player.current_week);
      const { data: latestBuilt } = await admin
        .from("elite_homework")
        .select("week")
        .eq("player_id", player.id)
        .order("week", { ascending: false })
        .limit(1)
        .maybeSingle();
      const maxBuilt = latestBuilt?.week ?? 0;

      // The week this run is responsible for: on Sunday the one starting
      // tomorrow, any other day the one the player is living in (week 1
      // for a player whose clock hasn't started). Built through it
      // already - nothing to do. applyGeneratedPlanCore applies the same
      // calendar rule when it picks the week number to write.
      const target = !player.week1_monday ? 1 : sundayEve ? liveWeek + 1 : liveWeek;
      if (maxBuilt >= target) {
        results.push({ playerId: player.id, name: player.full_name, ok: true, skipped: "already built" });
        continue;
      }

      const [{ data: lastHomework }, { data: lastCheckin }] = await Promise.all([
        admin
          .from("elite_homework")
          .select("title, completed")
          .eq("player_id", player.id)
          .eq("week", maxBuilt || 1),
        admin
          .from("elite_checkins")
          .select("rating, energy, went_well, struggled, note")
          .eq("player_id", player.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      // What the coach said on recent 1:1 calls (Complete Pathway) rides
      // along as the strongest steer - the cron otherwise only sees the
      // player's own completion + check-in.
      const callNotes = await latestCoachingCallNotes(player.id, admin).catch(() => "");
      const notes = [
        synthesizeNotes(lastHomework ?? [], lastCheckin ?? undefined),
        callNotes ? `Coach's notes from recent 1:1 calls (weight heavily): ${callNotes}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const { plan } = await generatePlanFromNotes(notes, player, player.coach_memory, bank);
      const applied = await applyGeneratedPlanCore(player.id, notes, plan, coach.id, admin);
      results.push({ playerId: player.id, name: player.full_name, ok: true, week: applied.week });
    } catch (err) {
      results.push({
        playerId: player.id,
        name: player.full_name,
        ok: false,
        error: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  const built = results.filter((r) => r.ok && r.week != null).length;
  const skipped = results.filter((r) => r.ok && r.skipped).length;
  const errors = results.flatMap((r) => (r.ok ? [] : [{ name: r.name, error: r.error }]));
  return { ran: results.length, built, skipped, errors, results };
}

// The one entry point both the cron route and the coach's "Build now"
// button use: run, log the run, and alert the coach when it went wrong.
export async function runPlanBuilder(opts: {
  trigger: "cron" | "coach";
  authed: boolean;
}): Promise<PlanBuilderOutcome> {
  const outcome = await runAutoWeeklyPlans();
  const summaryParts = [
    outcome.reason ? `did not run: ${outcome.reason}` : "",
    outcome.built
      ? `built ${outcome.results.filter((r) => r.ok && r.week != null).map((r) => `${r.name.split(" ")[0]} wk ${(r as { week?: number }).week}`).join(", ")}`
      : "",
    outcome.skipped ? `${outcome.skipped} already built` : "",
    outcome.errors.length
      ? `errors: ${outcome.errors.map((e) => `${e.name.split(" ")[0]} (${e.error})`).join("; ")}`
      : "",
  ].filter(Boolean);
  const summary = summaryParts.join(" · ") || "nothing to do";

  await recordCronRun({
    job: PLAN_BUILDER_JOB,
    trigger: opts.trigger,
    authed: opts.authed,
    built: outcome.built,
    skipped: outcome.skipped,
    errors: outcome.errors,
    summary,
  }).catch(() => undefined);

  // Loud when it matters: a per-player failure, or a run that could not
  // run at all. A quiet steady-state hour says nothing.
  const couldNotRun = Boolean(outcome.reason);
  if (outcome.errors.length > 0 || couldNotRun) {
    await alertCoach(
      `Strive plan builder: ${summary}. Open thestriveapp.com/coach and tap Build missing weeks to retry, or the next hourly run will.`
    );
  }
  return outcome;
}
