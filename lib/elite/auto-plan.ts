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
//     built. Held until early Monday (New York), when it opens; announced
//     Monday from 4:00 PM (unlock.ts).
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
import { getDrillBank, latestCoachingCallNotes, loadTemplateContext, loadProgramWeek } from "./data";
import { isSundayEveNY, liveWeekFor } from "./time";
import { alertCoach, FIRST_WEEK_JOB, latestCronRun, PLAN_BUILDER_JOB, startCronRun, updateCronRun } from "./cron-log";
import { auditLiveWeeks, type HealthIssue } from "./health";
import { backfillHomeworkVideos } from "./data";
import { builderTargetWeek } from "./week-target";
import { FIRST_WEEK_HELD, claimFirstWeek, releaseFirstWeek } from "./first-week-claim";
import { fmtBreakDate, settleBreaks } from "./breaks";
import { nyToday } from "./time";
import type { Player, TrainingBreak } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { backupIssue, backupReasonIn, backupSummary, writerReason, type BackupBuilt } from "./plan-writer";

type Result =
  // `backup`: the week was built, by the backup, and this is why the plan
  // writer did not write it (plan-writer.ts)
  | { playerId: string; name: string; ok: true; skipped?: string; week?: number; backup?: string }
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
  onProgress?: (results: Result[]) => Promise<void> | void,
  // One player only (a new member's first week, buildFirstWeekFor). The
  // same body, the same rules, the same gates: the roster is just one row.
  onlyPlayerId?: string
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

  let rosterQuery = admin
    .from("elite_players")
    .select("*")
    .not("onboarded_at", "is", null)
    .in("subscription_status", ["active", "trialing"]);
  if (onlyPlayerId) rosterQuery = rosterQuery.eq("id", onlyPlayerId);
  const { data: players } = await rosterQuery;
  const roster = (players as Player[] | null) ?? [];

  // Admin read - the drill table is coach-only under RLS and the cron has
  // no login (this exact line, without the client, built unfilmed weeks
  // from the starter library for two weeks).
  const { drills: bank } = await getDrillBank({ onlyWithVideo: true, client: admin });
  const sundayEve = isSundayEveNY();
  const results: Result[] = [];

  // Breaks (034): one read for the roster. A player on a break is skipped
  // outright; a player whose break just ended has their program clock
  // settled first, so the week built below is the week they left.
  const today = nyToday();
  const { data: breakRows } = roster.length
    ? await admin
        .from("elite_training_breaks")
        .select("player_id, since, until, resumed_at")
        .in("player_id", roster.map((p) => p.id))
    : { data: [] };
  const breaksByPlayer = new Map<string, Pick<TrainingBreak, "since" | "until" | "resumed_at">[]>();
  for (const b of ((breakRows as Pick<TrainingBreak, "player_id" | "since" | "until" | "resumed_at">[] | null) ?? [])) {
    breaksByPlayer.set(b.player_id, [...(breaksByPlayer.get(b.player_id) ?? []), b]);
  }

  for (const player of roster) {
    // The first-week claim (079), when this run holds it for this player.
    let claimedFirst = false;
    try {
      const breaks = breaksByPlayer.get(player.id) ?? [];
      const onBreak = breaks.find((b) => b.since <= today && today <= b.until);
      if (onBreak) {
        results.push({ playerId: player.id, name: player.full_name, ok: true, skipped: `on a break until ${fmtBreakDate(onBreak.until)}` });
        continue;
      }
      if (breaks.some((b) => !b.resumed_at && b.until < today)) {
        const { week1Monday } = await settleBreaks(admin, player, today);
        player.week1_monday = week1Monday;
      }
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

      // A FIRST week is built by one caller at a time (079): the building
      // screen after the quiz and this hourly run can reach the same new
      // player at once, and two interleaved builds would double the week.
      // Held elsewhere: build nothing. Table unreachable: build as before.
      if (maxBuilt === 0) {
        const claim = await claimFirstWeek(admin, player.id);
        if (claim === "held") {
          results.push({ playerId: player.id, name: player.full_name, ok: true, skipped: FIRST_WEEK_HELD });
          continue;
        }
        claimedFirst = claim === "claimed";
        if (claimedFirst) {
          // Another build may have finished between the read above and
          // the claim: check again under the claim.
          const { count } = await admin
            .from("elite_homework")
            .select("id", { count: "exact", head: true })
            .eq("player_id", player.id);
          if ((count ?? 0) > 0) {
            results.push({ playerId: player.id, name: player.full_name, ok: true, skipped: "already built" });
            continue;
          }
        }
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
      // Few-yards players (035): their week is the coach's templates.
      const tpl = await loadTemplateContext(player, admin);
      // The 3-month program (065): the focus and threads of the week
      // this run is building, or null for a player with no program.
      const program = await loadProgramWeek(player.id, target, admin);
      const written = await generatePlanFromNotes(notes, player, player.coach_memory, bank, tpl, program);
      const { plan } = written;
      // The backup wrote this week: never quietly (plan-writer.ts).
      const backup = written.source === "fallback" ? writerReason(written.reasonKind, written.reason) : undefined;
      const applied = await applyGeneratedPlanCore(player.id, notes, plan, coach.id, admin);
      if (applied.announced === false) {
        // The week is live but the announcement ledger could not be
        // written, so nothing was sent (announce.ts). Loud on purpose:
        // an error on the run row, and a text to the coach.
        results.push({
          playerId: player.id,
          name: player.full_name,
          ok: false,
          error: `week ${applied.week} is live but the family was not told (the announcement could not be recorded)`,
        });
      } else {
        results.push({ playerId: player.id, name: player.full_name, ok: true, week: applied.week, ...(backup ? { backup } : {}) });
      }
    } catch (err) {
      results.push({
        playerId: player.id,
        name: player.full_name,
        ok: false,
        error: err instanceof Error ? err.message : "unknown error",
      });
    } finally {
      // Built or not, the build ended: a later caller may take it over.
      if (claimedFirst) await releaseFirstWeek(admin, player.id);
    }
    await onProgress?.(results);
  }

  const built = results.filter((r) => r.ok && r.week != null).length;
  const skipped = results.filter((r) => r.ok && r.skipped).length;
  const errors = results.flatMap((r) => (r.ok ? [] : [{ name: r.name, error: r.error }]));
  return { ran: results.length, built, skipped, errors, results };
}

export type PlanBuilderInput = { trigger: "cron" | "coach"; authed: boolean };

// A new member's first week, the moment they finish the quiz (Nov 21 2026,
// the building screen). It is the hourly builder's own body for one player:
// the same week rule (a quiz finished on a Sunday is held to Monday), the
// same bank gates and the same announcement ledger, so it can never build
// anything the hourly run would not, and a second run (this, the hourly
// cron, a coach tap) finds the week built and does nothing. Logged under
// its own job; an error texts the coach like any builder error, and the
// hourly run tries again within the hour.
export async function buildFirstWeekFor(playerId: string): Promise<PlanBuilderOutcome> {
  const runId = await startCronRun({ job: FIRST_WEEK_JOB, trigger: "onboarding", authed: true }).catch(() => null);
  let outcome: PlanBuilderOutcome = { ran: 0, built: 0, skipped: 0, errors: [], results: [] };
  try {
    outcome = await runAutoWeeklyPlans(undefined, playerId);
  } catch (err) {
    outcome = { ...outcome, errors: [{ name: "run", error: err instanceof Error ? err.message : "unknown crash" }] };
  }
  // A first week the backup wrote is said on the run row and to the coach.
  const firstBackups = backupsIn(outcome);
  const firstIssues = firstBackups.length ? [backupIssue([...new Set(firstBackups.map((b) => b.reason))].join("; "))] : [];
  await updateCronRun(runId, {
    built: outcome.built,
    skipped: outcome.skipped,
    errors: outcome.errors,
    issues: firstIssues,
    summary: summarize(outcome),
    finished: true,
  }).catch(() => undefined);
  if (firstIssues.length > 0) {
    await alertCoach(`Strive plan builder needs you. A new member's first week: ${firstIssues[0].issue}.`);
  }
  if (outcome.errors.length > 0) {
    await alertCoach(
      `A new member's first week did not build when they finished the quiz: ${outcome.errors
        .map((e) => `${e.name} (${e.error})`)
        .join("; ")}. The hourly builder tries again within the hour.`
    );
  }
  return outcome;
}

function summarize(o: PlanBuilderOutcome): string {
  const parts = [
    o.reason ? `did not run: ${o.reason}` : "",
    o.built
      ? `built ${o.results
          .filter((r) => r.ok && r.week != null)
          .map((r) => `${r.name.split(" ")[0]} wk ${(r as { week?: number }).week}`)
          .join(", ")}`
      : "",
    o.results.some((r) => r.ok && r.skipped === "already built")
      ? `${o.results.filter((r) => r.ok && r.skipped === "already built").length} already built`
      : "",
    o.results.some((r) => r.ok && r.skipped?.startsWith("on a break"))
      ? `on a break: ${o.results
          .filter((r) => r.ok && r.skipped?.startsWith("on a break"))
          .map((r) => r.name.split(" ")[0])
          .join(", ")}`
      : "",
    o.errors.length
      ? `errors: ${o.errors.map((e) => `${e.name.split(" ")[0]} (${e.error})`).join("; ")}`
      : "",
    backupSummary(backupsIn(o)),
  ].filter(Boolean);
  return parts.join(" · ") || "nothing to do";
}

// The weeks of a run that the backup wrote.
function backupsIn(o: PlanBuilderOutcome): BackupBuilt[] {
  return o.results.flatMap((r) => (r.ok && r.week != null && r.backup ? [{ name: r.name, week: r.week, reason: r.backup }] : []));
}

// Whether the backup is still writing the weeks: this run's builds say so,
// or, on a run that built nothing, the last run that did. It stands until
// a week is written by the plan writer again.
async function standingBackupIssue(o: PlanBuilderOutcome, admin: SupabaseClient | null): Promise<HealthIssue | null> {
  const now = backupsIn(o);
  if (now.length > 0) return backupIssue([...new Set(now.map((b) => b.reason))].join("; "));
  if (o.built > 0 || !admin) return null; // weeks were built, and the plan writer wrote them
  try {
    const { data } = await admin
      .from("elite_cron_runs")
      .select("summary")
      .in("job", [PLAN_BUILDER_JOB, FIRST_WEEK_JOB])
      .gt("built", 0)
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const reason = backupReasonIn((data as { summary?: string } | null)?.summary);
    return reason ? backupIssue(reason) : null;
  } catch {
    return null;
  }
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
    const backup = await standingBackupIssue(outcome, admin);
    if (backup) issues = [...issues, backup];
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
