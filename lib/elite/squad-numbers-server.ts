// Reads what the seven numbers are counted from and hands it to the one
// calculator (lib/elite/squad-numbers.ts). Coach side only: it reads with
// the signed-in coach's own access, so a player's session gets nothing.
// It only reads; nothing on any player's record is changed.
import { createClient } from "./supabase/server";
import { everyRow } from "./supabase/every-row";
import { currentBreak } from "./breaks";
import { liveWeekFor, nyToday } from "./time";
import { nyDateOf } from "./reminders";
import { squadNumbers, type NumbersPlayer, type NumbersRow, type SquadNumbers } from "./squad-numbers";
import type { TrainingBreak } from "./types";

type PlayerRow = {
  id: string;
  full_name: string;
  subscription_status: string;
  tier: string | null;
  week1_monday: string | null;
  current_week: number | null;
  onboarded_at: string | null;
};

export async function getSquadNumbers(): Promise<SquadNumbers | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const today = nyToday();

  const { data: players, error } = await supabase
    .from("elite_players")
    .select("id, full_name, subscription_status, tier, week1_monday, current_week, onboarded_at")
    .not("onboarded_at", "is", null);
  if (error) return null;
  const roster = (players as PlayerRow[] | null) ?? [];
  if (roster.length === 0) return squadNumbers([], today);

  type Hw = NumbersRow & { player_id: string };
  const [rows, clips, { data: breaks }] = await Promise.all([
    everyRow<Hw>((from, to) =>
      supabase
        .from("elite_homework")
        .select("player_id, week, session, is_extra, completed, completed_at")
        .order("id")
        .range(from, to)
    ),
    everyRow<{ player_id: string; week: number }>((from, to) =>
      supabase.from("elite_progress_videos").select("player_id, week").order("id").range(from, to)
    ),
    supabase.from("elite_training_breaks").select("player_id, since, until").gte("until", today),
  ]);

  const rowsBy = new Map<string, NumbersRow[]>();
  for (const r of rows) rowsBy.set(r.player_id, [...(rowsBy.get(r.player_id) ?? []), r]);
  const clipsBy = new Map<string, number[]>();
  for (const c of clips) clipsBy.set(c.player_id, [...(clipsBy.get(c.player_id) ?? []), c.week]);
  const breaksBy = new Map<string, Pick<TrainingBreak, "since" | "until">[]>();
  for (const b of (breaks as (Pick<TrainingBreak, "since" | "until"> & { player_id: string })[] | null) ?? []) {
    breaksBy.set(b.player_id, [...(breaksBy.get(b.player_id) ?? []), b]);
  }

  const everyone: NumbersPlayer[] = roster.map((p) => ({
    id: p.id,
    name: p.full_name,
    member: p.subscription_status === "active" || p.subscription_status === "trialing",
    tier: p.tier,
    // The program clock (the Monday of their week 1). A player whose first
    // week is not built yet has no clock: they count from the day they
    // finished the quiz, with nothing yet to do.
    startDay: p.week1_monday ?? (p.onboarded_at ? nyDateOf(p.onboarded_at) : null),
    liveWeek: liveWeekFor(p.week1_monday, p.current_week),
    onBreak: currentBreak(breaksBy.get(p.id) ?? [], today) !== null,
    rows: rowsBy.get(p.id) ?? [],
    clipWeeks: clipsBy.get(p.id) ?? [],
  }));
  return squadNumbers(everyone, today);
}
