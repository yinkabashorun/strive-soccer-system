// Achievement engine. Every badge here is earned from data the app
// actually tracks — completions, streaks, minutes. Nothing subjective,
// nothing the system can't prove. Awarding runs best-effort after a drill
// is completed and inserts via the service client (players have no write
// access to elite_achievements).

import { createServiceClient } from "./supabase/server";
import { computeSummary, isDemo } from "./data";
import type { Homework, PlayerSummary } from "./types";

type Rule = {
  title: string;
  detail: string;
  icon: string; // lucide name known to the dashboard ICONS map
  earned: (hw: Homework[], s: PlayerSummary) => boolean;
};

// Weeks where every assigned drill is completed, sorted ascending.
function completedWeeks(hw: Homework[]): number[] {
  const byWeek = new Map<number, { total: number; done: number }>();
  for (const h of hw) {
    const w = byWeek.get(h.week) ?? { total: 0, done: 0 };
    w.total++;
    if (h.completed) w.done++;
    byWeek.set(h.week, w);
  }
  return [...byWeek.entries()]
    .filter(([, w]) => w.total > 0 && w.done === w.total)
    .map(([week]) => week)
    .sort((a, b) => a - b);
}

function hasConsecutiveRun(weeks: number[], run: number): boolean {
  let chain = 1;
  for (let i = 1; i < weeks.length; i++) {
    chain = weeks[i] === weeks[i - 1] + 1 ? chain + 1 : 1;
    if (chain >= run) return true;
  }
  return run <= 1 && weeks.length > 0;
}

const RULES: Rule[] = [
  {
    title: "First Session",
    detail: "Your first full session, done",
    icon: "Sparkles",
    earned: (_hw, s) => s.sessions_completed >= 1,
  },
  {
    title: "Week Conquered",
    detail: "Every drill in a week, done",
    icon: "CheckCircle2",
    earned: (hw) => completedWeeks(hw).length >= 1,
  },
  {
    title: "3 Perfect Weeks",
    detail: "Three straight weeks at 100%",
    icon: "Trophy",
    earned: (hw) => hasConsecutiveRun(completedWeeks(hw), 3),
  },
  {
    title: "7-Day Streak",
    detail: "Trained seven days in a row",
    icon: "Flame",
    earned: (_hw, s) => s.current_streak >= 7,
  },
  {
    title: "500 Minutes",
    detail: "500 minutes of focused training",
    icon: "Zap",
    earned: (_hw, s) => s.training_minutes >= 500,
  },
  {
    title: "1,000 Minutes",
    detail: "A thousand minutes in the bank",
    icon: "Target",
    earned: (_hw, s) => s.training_minutes >= 1000,
  },
];

// Evaluate every rule for the player and award anything newly earned.
// Idempotent (title-keyed), silent on failure — a missed badge must never
// break a drill completion.
export async function maybeAwardAchievements(playerId: string): Promise<void> {
  if (isDemo(playerId)) return;
  const admin = createServiceClient();
  if (!admin) return;

  const { data: hwRows } = await admin
    .from("elite_homework")
    .select("*")
    .eq("player_id", playerId);
  const hw = (hwRows as Homework[] | null) ?? [];
  if (hw.length === 0) return;
  const summary = computeSummary(hw);

  const { data: existing } = await admin
    .from("elite_achievements")
    .select("title")
    .eq("player_id", playerId);
  const have = new Set(((existing as { title: string }[] | null) ?? []).map((a) => a.title));

  const fresh = RULES.filter((r) => !have.has(r.title) && r.earned(hw, summary));
  if (fresh.length === 0) return;

  await admin.from("elite_achievements").insert(
    fresh.map((r) => ({
      player_id: playerId,
      title: r.title,
      detail: r.detail,
      icon: r.icon,
    }))
  );
  await admin.from("elite_notifications").insert(
    fresh.map((r) => ({
      player_id: playerId,
      kind: "achievement",
      title: `Achievement unlocked: ${r.title}`,
      body: r.detail,
    }))
  );
}
