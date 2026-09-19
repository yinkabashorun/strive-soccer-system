// Fully automated weekly plan generation. Coach Yinka no longer writes a
// note or clicks approve for this to run - a weekly cron (see
// app/api/elite/cron/weekly-plans) calls runAutoWeeklyPlans() for every
// active, onboarded player. In place of a coach's typed session notes, the
// "notes" the AI sees are synthesized from what actually happened: last
// week's homework completion and the player's own self-checkin. The
// personalization promise in the copy ("I build every plan, I review every
// plan") stays as-is per CLAUDE.md - the backend changed, the copy didn't.
import { createServiceClient } from "./supabase/server";
import { generatePlanFromNotes } from "./ai-coach";
import { applyGeneratedPlanCore } from "./coach-actions";
import { getDrillBank } from "./data";
import { liveWeekFor } from "./time";
import type { Player } from "./types";

type Result =
  | { playerId: string; name: string; ok: true; skipped?: string; week?: number }
  | { playerId: string; name: string; ok: false; error: string };

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

export async function runAutoWeeklyPlans(): Promise<{ ran: number; results: Result[] }> {
  const admin = createServiceClient();
  if (!admin) return { ran: 0, results: [] };

  const { data: coach } = await admin
    .from("elite_profiles")
    .select("id")
    .eq("role", "coach")
    .limit(1)
    .maybeSingle();
  if (!coach?.id) return { ran: 0, results: [] };

  const { data: players } = await admin
    .from("elite_players")
    .select("*")
    .not("onboarded_at", "is", null)
    .in("subscription_status", ["active", "trialing"]);
  const roster = (players as Player[] | null) ?? [];

  const { drills: bank } = await getDrillBank();
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

      // Already has this week or later built (manual edit, or already ran
      // this cycle) - never overwrite a plan that's ahead of the calendar.
      if (maxBuilt > liveWeek || (maxBuilt === liveWeek && player.week1_monday)) {
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

      const notes = synthesizeNotes(lastHomework ?? [], lastCheckin ?? undefined);
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

  return { ran: results.length, results };
}
