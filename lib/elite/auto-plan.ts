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
import { alertCoach, latestCronRun, PLAN_BUILDER_JOB, startCronRun, updateCronRun } from "./cron-log";
import { auditLiveWeeks, type HealthIssue } from "./health";
import { backfillHomeworkVideos } from "./data";
import { builderTargetWeek } from "./week-target";
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

export async function runAutoWeeklyPlans(
  onProgress?: (results: Result[]) => Promise<void> | void
): Promise<PlanBuilderOutcome> {
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

  // Admin read - the drill table is coach-only under RLS and the cron has
  // no login (this exact line, without the client, built unfilmed weeks
  // from the starter library for two weeks).
  const { drills: bank } = await getDrillBank({ onlyWithVideo: true, client: admin });
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
      const target = builderTargetWeek({ hasClock: Boolean(player.week1_monday), liveWeek, sundayEve });
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
    await onProgress?.(results);
  }

  const built = results.filter((r) => r.ok && r.week != null).length;
  const skipped = results.filter((r) => r.ok && r.skipped).length;
  const errors = results.flatMap((r) => (r.ok ? [] : [{ name: r.name, error: r.error }]));
  return { ran: results.length, built, skipped, errors, results };
}

export type PlanBuilderInput = { trigger: "cron" | "coach"; authed: boolean };

function summarize(o: PlanBuilderOutcome): string {
  const parts = [
    o.reason ? `did not run: ${o.reason}` : "",
    o.built
      ? `built ${o.results
          .filter((r) => r.ok && r.week != null)
          .map((r) => `${r.name.split(" ")[0]} wk ${(r as { week?: number }).week}`)
          .join(", ")}`
      : "",
    o.skipped ? `${o.skipped} already built` : "",
    o.errors.length
      ? `errors: ${o.errors.map((e) => `${e.name.split(" ")[0]} (${e.error})`).join("; ")}`
      : "",
  ].filter(Boolean);
  return parts.join(" · ") || "nothing to do";
}

function tally(results: Result[]) {
  return {
    built: results.filter((r) => r.ok && r.week != null).length,
    skipped: results.filter((r) => r.ok && r.skipped).length,
    errors: results.flatMap((r) => (r.ok ? [] : [{ name: r.name, error: r.error }])),
  };
}

// The one entry point both the cron route and the coach's "Build now"
// button use: log the start, build, heal, audit, log the end, and alert
// the coach when something is wrong that wasn't wrong last run.
export async function runPlanBuilder(opts: PlanBuilderInput): Promise<PlanBuilderOutcome & { issues: HealthIssue[] }> {
  const runId = await startCronRun({ job: PLAN_BUILDER_JOB, ...opts }).catch(() => null);
  let outcome: PlanBuilderOutcome = { ran: 0, built: 0, skipped: 0, errors: [], results: [] };
  let issues: HealthIssue[] = [];
  let crashed: string | null = null;
  try {
    outcome = await runAutoWeeklyPlans(async (results) => {
      const t = tally(results);
      await updateCronRun(runId, { ...t, summary: `running: ${results.length} done` }).catch(() => undefined);
    });

    // Heal + audit, independent of the build: videos added to the bank
    // later reach waiting homework, and every live week is checked
    // against the rules in lib/elite/health.ts.
    const admin = createServiceClient();
    if (admin) {
      await backfillHomeworkVideos(admin).catch(() => undefined);
      issues = await auditLiveWeeks(admin).catch((e: unknown) => [
        { name: "audit", issue: e instanceof Error ? e.message : "audit failed" },
      ]);
    }
  } catch (err) {
    crashed = err instanceof Error ? err.message : "unknown crash";
    outcome = { ...outcome, errors: [...outcome.errors, { name: "run", error: crashed }] };
  }

  const summary = summarize(outcome) + (issues.length ? ` · audit: ${issues.length} issue${issues.length === 1 ? "" : "s"}` : " · audit clean");
  await updateCronRun(runId, {
    built: outcome.built,
    skipped: outcome.skipped,
    errors: outcome.errors,
    issues,
    summary,
    finished: true,
  }).catch(() => undefined);

  // Alert on anything wrong - but only when it is NEW compared to the
  // previous run, so a standing problem is one text, not one per hour.
  const wrongNow = Boolean(outcome.reason) || outcome.errors.length > 0 || issues.length > 0;
  if (wrongNow) {
    const prev = await latestCronRun(PLAN_BUILDER_JOB, runId).catch(() => null);
    const fingerprint = (errs: { name: string; error?: string; issue?: string }[], reason?: string | null) =>
      JSON.stringify([reason ?? "", ...errs.map((e) => `${e.name}:${e.error ?? e.issue ?? ""}`)].sort());
    const nowKey = fingerprint([...outcome.errors, ...issues], outcome.reason);
    const prevKey = prev ? fingerprint([...(prev.errors ?? []), ...(prev.issues ?? [])], prev.summary.startsWith("did not run") ? prev.summary : "") : "";
    if (nowKey !== prevKey) {
      const lines = [
        outcome.reason ? `could not run: ${outcome.reason}` : "",
        ...outcome.errors.map((e) => `${e.name}: ${e.error}`),
        ...issues.map((i) => `${i.name}: ${i.issue}`),
      ].filter(Boolean);
      await alertCoach(
        `Strive plan builder needs you. ${lines.join(". ")}. Open thestriveapp.com/coach - the Plan builder card has the detail and a Build missing weeks button.`
      );
    }
  }
  return { ...outcome, issues };
}
