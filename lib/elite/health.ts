// Live-week audit: the invariants a player's CURRENT week must satisfy,
// checked after every builder run, by code that is independent of the
// code that built the week. If a future change breaks any rule the
// builder relies on, this is what notices - within the hour, from the
// data itself, not from a parent's DM.
//
//   - every active, onboarded player has a plan for the week they are in
//   - every drill in that week links a bank drill by id (drill_id)
//   - every drill in that week has a video
//   - every linked drill is still active in the bank
//
// Pure rule in auditWeekRows (unit-tested); the DB read wraps it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { liveWeekFor } from "./time";

export type HealthIssue = { name: string; issue: string };

export type WeekRow = {
  week: number;
  video_url: string | null;
  drill_id: string | null;
  drill_active: boolean | null; // null = drill row missing
};

export function auditWeekRows(
  name: string,
  liveWeek: number,
  rows: WeekRow[]
): HealthIssue[] {
  const maxBuilt = rows.reduce((m, r) => Math.max(m, r.week), 0);
  if (maxBuilt < liveWeek) {
    return [{ name, issue: `no plan for live week ${liveWeek} (built through ${maxBuilt})` }];
  }
  const current = rows.filter((r) => r.week === liveWeek);
  const out: HealthIssue[] = [];
  const noVideo = current.filter((r) => !r.video_url).length;
  const unlinked = current.filter((r) => !r.drill_id).length;
  const inactive = current.filter((r) => r.drill_id && r.drill_active !== true).length;
  if (noVideo) out.push({ name, issue: `${noVideo} drill${noVideo === 1 ? "" : "s"} without a video in week ${liveWeek}` });
  if (unlinked) out.push({ name, issue: `${unlinked} drill${unlinked === 1 ? "" : "s"} not linked to the bank in week ${liveWeek}` });
  if (inactive) out.push({ name, issue: `${inactive} drill${inactive === 1 ? "" : "s"} linked to a missing/inactive bank drill in week ${liveWeek}` });
  return out;
}

export async function auditLiveWeeks(admin: SupabaseClient): Promise<HealthIssue[]> {
  const { data: players } = await admin
    .from("elite_players")
    .select("id, full_name, week1_monday, current_week")
    .not("onboarded_at", "is", null)
    .in("subscription_status", ["active", "trialing"]);
  const roster =
    (players as { id: string; full_name: string; week1_monday: string | null; current_week: number }[] | null) ?? [];
  if (roster.length === 0) return [];

  const { data: hw } = await admin
    .from("elite_homework")
    .select("player_id, week, video_url, drill_id, elite_drills(active)")
    .in("player_id", roster.map((p) => p.id));
  type Raw = {
    player_id: string;
    week: number;
    video_url: string | null;
    drill_id: string | null;
    elite_drills: { active: boolean } | { active: boolean }[] | null;
  };
  const byPlayer = new Map<string, WeekRow[]>();
  for (const r of ((hw as Raw[] | null) ?? [])) {
    const d = Array.isArray(r.elite_drills) ? r.elite_drills[0] : r.elite_drills;
    const list = byPlayer.get(r.player_id) ?? [];
    list.push({
      week: r.week,
      video_url: r.video_url,
      drill_id: r.drill_id,
      drill_active: r.drill_id ? (d ? d.active : null) : null,
    });
    byPlayer.set(r.player_id, list);
  }
  const issues: HealthIssue[] = [];
  for (const p of roster) {
    const live = liveWeekFor(p.week1_monday, p.current_week);
    issues.push(...auditWeekRows(p.full_name.split(" ")[0], live, byPlayer.get(p.id) ?? []));
  }
  return issues;
}
