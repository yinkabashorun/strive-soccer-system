// Achievement engine, the server half. The rules themselves (and the rule
// that nothing a break can take away is ever a badge) live in
// achievement-rules.ts, pure and tested. Awarding runs best-effort after a
// drill is completed and inserts via the service client (players have no
// write access to elite_achievements).

import { createServiceClient } from "./supabase/server";
import { computeSummary, isDemo } from "./data";
import { newlyEarned } from "./achievement-rules";
import type { Homework } from "./types";

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

  const fresh = newlyEarned(hw, summary, have);
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
