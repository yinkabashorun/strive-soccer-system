// Strive Elite — per-player AI memory.
//
// Before the AI builds a new week, we assemble everything we know about a
// player into a compact block: their profile + intake, the coach's freeform
// memory note, recent weeks, what they actually completed vs skipped, how
// their pillars have trended, and their latest check-in. This is what turns
// the plan generator from "aware of a profile" into "remembers this player".

import {
  getCheckins,
  getHomework,
  getProgress,
  getProgressHistory,
  getWeeklyPlans,
} from "./data";
import type { Player } from "./types";

// Builds the memory text injected into the AI prompt. Returns "" when there
// is nothing meaningful yet (a brand-new player), so the first plan just
// leans on the intake.
export async function buildPlayerMemory(player: Player): Promise<string> {
  const [homework, progress, history, checkins, plans] = await Promise.all([
    getHomework(player.id),
    getProgress(player.id),
    getProgressHistory(player.id),
    getCheckins(player.id),
    getWeeklyPlans(player.id),
  ]);

  const lines: string[] = [];

  // Coach's freeform memory note — the most important human signal.
  if (player.coach_memory?.trim()) {
    lines.push(`COACH'S NOTE ON THIS PLAYER (weight this heavily): ${player.coach_memory.trim()}`);
  }

  // Intake starting line.
  const intake: string[] = [];
  if (player.dominant_foot) intake.push(`${player.dominant_foot}-footed`);
  if (player.club) intake.push(`plays for ${player.club}`);
  if (player.self_assessment && Object.keys(player.self_assessment).length) {
    const self = Object.entries(player.self_assessment)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    intake.push(`self-rated at intake: ${self}`);
  }
  if (intake.length) lines.push(`INTAKE: ${intake.join("; ")}.`);

  // Recent weeks (last 3) — build forward, don't repeat.
  const recentPlans = plans.slice(0, 3);
  if (recentPlans.length) {
    const summary = recentPlans
      .map((p) => `Week ${p.week}: "${p.focus}"`)
      .join(" | ");
    lines.push(`RECENT WEEKS (most recent first): ${summary}. Build forward from these — do not simply repeat them.`);
  }

  // Completion signal for the most recent trained week.
  const completion = mostRecentWeekCompletion(homework);
  if (completion) lines.push(completion);

  // Pillar trends over the season.
  const trends = pillarTrends(progress, history);
  if (trends) lines.push(`PILLAR TRENDS: ${trends}. Push the lagging pillars.`);

  // Latest check-in in the player's own words.
  const last = checkins[0];
  if (last) {
    const parts: string[] = [];
    if (last.rating) parts.push(`rated the week ${last.rating}/5`);
    if (last.energy) parts.push(`energy ${last.energy}/5`);
    if (last.went_well) parts.push(`went well: ${last.went_well}`);
    if (last.struggled) parts.push(`struggled with: ${last.struggled}`);
    if (last.note) parts.push(`note: ${last.note}`);
    if (parts.length)
      lines.push(`LATEST CHECK-IN (player's own words): ${parts.join("; ")}.`);
  }

  if (lines.length === 0) return "";
  return `WHAT WE KNOW ABOUT THIS PLAYER (use it to plan around them):\n${lines
    .map((l) => `- ${l}`)
    .join("\n")}`;
}

// For the most recently-trained week, report what was completed vs skipped —
// a drill a player keeps skipping should be rethought, not re-sent.
function mostRecentWeekCompletion(
  homework: { week: number; title: string; completed: boolean }[]
): string | null {
  if (!homework.length) return null;
  const maxWeek = Math.max(...homework.map((h) => h.week));
  const wk = homework.filter((h) => h.week === maxWeek);
  if (!wk.length) return null;
  const done = wk.filter((h) => h.completed);
  const skipped = wk.filter((h) => !h.completed);
  const pct = Math.round((done.length / wk.length) * 100);
  let s = `LAST WEEK'S FOLLOW-THROUGH: completed ${done.length}/${wk.length} drills (${pct}%)`;
  if (skipped.length) {
    const names = skipped.slice(0, 4).map((h) => h.title).join(", ");
    s += `. Repeatedly left undone: ${names} — reconsider or reframe these`;
  }
  return s + ".";
}

// Direction of travel per pillar: current value and whether it's climbing,
// flat, or slipping vs the earliest history point.
function pillarTrends(
  progress: { metric: string; value: number }[],
  history: { metric: string; value: number; created_at: string }[]
): string | null {
  if (!progress.length) return null;
  const firstByMetric = new Map<string, number>();
  for (const h of history) {
    if (!firstByMetric.has(h.metric)) firstByMetric.set(h.metric, h.value);
  }
  return progress
    .map((p) => {
      const start = firstByMetric.get(p.metric);
      let dir = "";
      if (start !== undefined) {
        const delta = p.value - start;
        dir = delta > 3 ? " ↑" : delta < -3 ? " ↓" : " →";
      }
      return `${p.metric} ${p.value}${dir}`;
    })
    .join(", ");
}
