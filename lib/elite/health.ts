// Live-week audit: the invariants a player's CURRENT week must satisfy,
// checked after every builder run, by code that is independent of the
// code that built the week. If a future change breaks any rule the
// builder relies on, this is what notices - within the hour, from the
// data itself, not from a parent's DM.
//
//   - every active, onboarded player has a plan for the week they are in
//     (a player on a break, 034, is left out: nothing is built for them
//     on purpose, so "no plan" would be a false alarm)
//   - every drill in that week links a bank drill by id (drill_id)
//   - every drill in that week has a video
//   - every linked drill is still active in the bank
//   - a few-yards player (035) has templates to train from, and the live
//     week did not have to repeat one
//
// Pure rule in auditWeekRows (unit-tested); the DB read wraps it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { liveWeekFor, nyToday } from "./time";
import { isOnBreak } from "./breaks";

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

// Few-yards invariants (035). Pure, unit-tested. templateCount = active
// tight templates in the bank; rows = the player's homework.
export type TemplateRow = { week: number; session: number | null; template_id: string | null };

export function auditTemplateRows(
  name: string,
  liveWeek: number,
  space: string | null | undefined,
  templateCount: number,
  rows: TemplateRow[]
): HealthIssue[] {
  if (space !== "tight") return [];
  if (templateCount === 0) {
    return [{ name, issue: "few-yards player with no few-yards sessions built yet (week composed from ticked drills)" }];
  }
  const current = rows.filter((r) => r.week === liveWeek && r.template_id);
  const bySession = new Map<number, string>();
  for (const r of current) bySession.set(r.session ?? 1, r.template_id as string);
  const used = [...bySession.values()];
  const distinct = new Set(used).size;
  if (used.length > distinct) {
    return [{ name, issue: `only ${templateCount} few-yards session${templateCount === 1 ? "" : "s"} built, week ${liveWeek} repeats one (needs ${used.length})` }];
  }
  return [];
}

export async function auditLiveWeeks(admin: SupabaseClient): Promise<HealthIssue[]> {
  const { data: players } = await admin
    .from("elite_players")
    .select("id, full_name, week1_monday, current_week, space")
    .not("onboarded_at", "is", null)
    .in("subscription_status", ["active", "trialing"]);
  const everyone =
    (players as { id: string; full_name: string; week1_monday: string | null; current_week: number; space?: string | null }[] | null) ?? [];
  if (everyone.length === 0) return [];
  const roster = await withoutPlayersOnBreak(admin, everyone);
  if (roster.length === 0) return [];

  const { data: hw } = await admin
    .from("elite_homework")
    .select("player_id, week, session, video_url, drill_id, template_id, elite_drills(active)")
    .in("player_id", roster.map((p) => p.id));
  type Raw = {
    player_id: string;
    week: number;
    session: number | null;
    video_url: string | null;
    drill_id: string | null;
    template_id?: string | null;
    elite_drills: { active: boolean } | { active: boolean }[] | null;
  };
  const byPlayer = new Map<string, WeekRow[]>();
  const tplByPlayer = new Map<string, TemplateRow[]>();
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
    const tl = tplByPlayer.get(r.player_id) ?? [];
    tl.push({ week: r.week, session: r.session, template_id: r.template_id ?? null });
    tplByPlayer.set(r.player_id, tl);
  }
  // Active few-yards templates in the bank (035); pre-035 = none.
  let templateCount = 0;
  if (roster.some((p) => p.space === "tight")) {
    const { count } = await admin
      .from("elite_session_templates")
      .select("id", { count: "exact", head: true })
      .eq("space", "tight")
      .eq("active", true);
    templateCount = count ?? 0;
  }
  const issues: HealthIssue[] = [];
  for (const p of roster) {
    const live = liveWeekFor(p.week1_monday, p.current_week);
    const first = p.full_name.split(" ")[0];
    issues.push(...auditWeekRows(first, live, byPlayer.get(p.id) ?? []));
    issues.push(...auditTemplateRows(first, live, p.space, templateCount, tplByPlayer.get(p.id) ?? []));
  }
  return issues;
}

// Drop every player who is on a break today (034). Shared by the audit
// and anything else that must leave a resting player alone.
export async function withoutPlayersOnBreak<T extends { id: string }>(
  admin: SupabaseClient,
  players: T[],
  today: string = nyToday()
): Promise<T[]> {
  if (players.length === 0) return players;
  const { data, error } = await admin
    .from("elite_training_breaks")
    .select("player_id, since, until")
    .in("player_id", players.map((p) => p.id))
    .lte("since", today)
    .gte("until", today);
  if (error || !data) return players; // pre-034: nobody is on a break
  const byPlayer = new Map<string, { since: string; until: string }[]>();
  for (const b of data as { player_id: string; since: string; until: string }[]) {
    byPlayer.set(b.player_id, [...(byPlayer.get(b.player_id) ?? []), b]);
  }
  return players.filter((p) => !isOnBreak(byPlayer.get(p.id) ?? [], today));
}
