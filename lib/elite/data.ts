import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "./supabase/server";
import {
  DEMO_ACHIEVEMENTS,
  DEMO_CHECKINS,
  DEMO_GAMES,
  DEMO_FILM,
  DEMO_HOMEWORK,
  DEMO_MESSAGES,
  DEMO_NOTES,
  DEMO_PARENT_REPORTS,
  DEMO_PLAYERS,
  DEMO_PROGRESS,
  DEMO_WEEKLY_PLANS,
} from "./demo";
import type {
  Achievement,
  Checkin,
  CoachingCall,
  Game,
  CoachNote,
  Drill,
  EliteNotification,
  FilmUpload,
  Homework,
  Message,
  ParentReport,
  Player,
  PlayerSummary,
  Progress,
  ProgressPoint,
  RosterRow,
  WeeklyPlan, CronRun } from "./types";
import { METHOD_PILLARS } from "./methodology";

// Server-side data access for Strive Elite. Reads from Supabase when
// configured, otherwise returns the demo dataset. The UI is identical in
// both modes so the deployed app is fully tourable before wiring Supabase.

// Demo-tour ids ("p-marcus"…) ALWAYS serve demo data - even in production
// with Supabase configured - so the login-page "tour the app" experience
// works everywhere and never touches real rows.
const DEMO_IDS = new Set(DEMO_PLAYERS.map((p) => p.id));
export const isDemo = (id: string) => DEMO_IDS.has(id);

export async function getPlayers(): Promise<Player[]> {
  const supabase = createClient();
  if (!supabase) return DEMO_PLAYERS;
  const { data } = await supabase
    .from("elite_players")
    .select("*")
    .order("full_name");
  return (data as Player[] | null) ?? [];
}

export async function getPlayer(id: string): Promise<Player | null> {
  const supabase = createClient();
  if (!supabase || isDemo(id)) return DEMO_PLAYERS.find((p) => p.id === id) ?? null;
  const { data } = await supabase
    .from("elite_players")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Player | null) ?? null;
}

export async function getHomework(playerId: string): Promise<Homework[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId))
    return DEMO_HOMEWORK.filter((h) => h.player_id === playerId).sort(
      (a, b) => a.sort - b.sort
    );
  const { data } = await supabase
    .from("elite_homework")
    .select("*")
    .eq("player_id", playerId)
    .order("sort");
  return (data as Homework[] | null) ?? [];
}

// Highest week number each player has homework for - i.e. how far ahead
// their plan is built. One bulk query; the coach dashboard uses it to flag
// who still needs next week built.
export async function getPlanCoverage(): Promise<Record<string, number>> {
  const supabase = createClient();
  const out: Record<string, number> = {};
  if (!supabase) {
    for (const h of DEMO_HOMEWORK) {
      out[h.player_id] = Math.max(out[h.player_id] ?? 0, h.week);
    }
    return out;
  }
  const { data, error } = await supabase
    .from("elite_homework")
    .select("player_id, week");
  if (error || !data) return out;
  for (const h of data as { player_id: string; week: number }[]) {
    out[h.player_id] = Math.max(out[h.player_id] ?? 0, h.week ?? 0);
  }
  return out;
}

// Latest run of a background job (030) - the coach dashboard shows the
// plan builder's. null in demo mode or before the migration.
export async function getLatestCronRun(job: string): Promise<CronRun | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("elite_cron_runs")
    .select("*")
    .eq("job", job)
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CronRun | null) ?? null;
}

// The built-in Strive method library shaped as Drill rows - what the bank
// looks like before migration 020 runs (or in demo mode). Read-only.
export function libraryDrills(): Drill[] {
  const out: Drill[] = [];
  let sort = 0;
  for (const g of METHOD_PILLARS) {
    for (const d of g.drills) {
      sort += 10;
      out.push({
        id: `lib-${sort}`,
        pillar: g.pillar,
        title: d.title,
        how: d.how,
        reps: d.reps,
        minutes: d.minutes,
        cues: d.cues ?? "",
        needs_wall: Boolean(d.needsWall),
        active: true,
        sort,
      });
    }
  }
  return out;
}

// The coach's drill bank: every drill the AI may prescribe. Falls back to
// the built-in library pre-020 (or demo) so generation never has an empty
// bank. Pass onlyWithVideo when the caller is about to ASSIGN drills to a
// player (AI generation, the deterministic fallback plan) - it keeps a
// coach adding a new drill before filming it from ever reaching a real
// player's homework, without hiding that drill from the coach's own
// /coach/drills management page (which still needs the full bank).
// The bank a plan is built from. Reads with the server's own admin access
// by default: the drill table is coach-only under RLS, and the hourly
// plan builder has no login - until Oct 2 2026 it got ZERO rows back,
// silently fell through to the built-in starter library (no videos), and
// every cron-built week since Sept 19 carried unfilmed drills because of
// it. The bank is coach content that players see anyway, so an admin read
// is safe. onlyWithVideo NEVER returns the library: if the real bank is
// unreachable or has no filmed drill, the caller gets an empty list and
// publishing refuses (see applyGeneratedPlanCore) instead of inventing.
export async function getDrillBank(opts?: {
  onlyWithVideo?: boolean;
  client?: SupabaseClient;
}): Promise<{ drills: Drill[]; fromDb: boolean }> {
  const supabase = opts?.client ?? createServiceClient() ?? createClient();
  let drills: Drill[];
  let fromDb: boolean;
  if (!supabase) {
    drills = libraryDrills();
    fromDb = false;
  } else {
    const { data, error } = await supabase
      .from("elite_drills")
      .select("*")
      .eq("active", true)
      .order("pillar")
      .order("sort");
    if (error || !data || data.length === 0) {
      drills = libraryDrills();
      fromDb = false;
    } else {
      drills = data as Drill[];
      fromDb = true;
    }
  }
  if (opts?.onlyWithVideo) {
    drills = filmedBankOnly(drills, fromDb);
  }
  return { drills, fromDb };
}

// Pure (unit-tested): the only drills a real plan may be built from. The
// starter library is never one of them, whatever it contains.
export function filmedBankOnly(drills: Drill[], fromDb: boolean): Drill[] {
  if (!fromDb) return [];
  return drills.filter((d) => Boolean(d.video_url));
}

// Shared title normalization for matching a homework row's title to a bank
// drill's title when there's no drill_id link yet to go on. Trims,
// lowercases, collapses internal whitespace, and drops trailing
// punctuation, so minor formatting drift (an extra space, a trailing
// period) doesn't break the match. Exported so every place that ever
// needs to fall back to title matching (publish time, backfill) stays in
// sync with exactly the same rule.
export function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,!?;:]+$/g, "");
}

// Repairs homework whose video is missing or whose link to its actual bank
// drill was never established. Two passes:
//   1. ID pass (robust, permanent): any row already linked by drill_id just
//      needs its video_url re-copied from that same drill - immune to the
//      AI's title text ever drifting, since nothing is matched by text here.
//   2. Title pass (best-effort, legacy/unlinked rows only): normalized
//      title match against the bank, same as before drill_id existed. When
//      this finds a match it sets BOTH video_url and drill_id, so that row
//      graduates to the robust ID path for every future run.
// Idempotent and safe either way: only ever fills what's missing, never
// touches a row that's already fully linked and has a video.
export async function backfillHomeworkVideos(
  admin: SupabaseClient
): Promise<number> {
  let fixed = 0;

  // Pass 1: ID-linked rows, re-synced from their drill's current video.
  const { data: linked } = await admin
    .from("elite_homework")
    .select("id, drill_id, video_url")
    .not("drill_id", "is", null);
  const linkedMissing = (
    (linked ?? []) as { id: string; drill_id: string; video_url: string | null }[]
  ).filter((h) => !h.video_url);
  if (linkedMissing.length > 0) {
    const { data: drills } = await admin
      .from("elite_drills")
      .select("id, video_url")
      .in("id", [...new Set(linkedMissing.map((h) => h.drill_id))]);
    const videoById = new Map(
      (drills ?? [])
        .filter((d) => d.video_url)
        .map((d) => [d.id as string, d.video_url as string])
    );
    for (const h of linkedMissing) {
      const video_url = videoById.get(h.drill_id);
      if (!video_url) continue;
      const { error } = await admin
        .from("elite_homework")
        .update({ video_url })
        .eq("id", h.id);
      if (!error) fixed++;
    }
  }

  // Pass 2: every unlinked row, not just ones currently missing a video -
  // published before drill_id existed, or the publish-time match failed.
  // Fall back to normalized title matching and set drill_id when found, so
  // even a row that already has a video graduates onto the robust id path
  // and picks up any future update to that drill's video too, not just
  // today's gap.
  const { data: unlinked } = await admin
    .from("elite_homework")
    .select("id, title")
    .is("drill_id", null);
  if (unlinked && unlinked.length > 0) {
    const { data: bank } = await admin.from("elite_drills").select("id, title, video_url");
    const byTitle = new Map<string, { id: string; video_url: string | null }>();
    for (const d of bank ?? []) {
      byTitle.set(normalizeTitle(String(d.title)), { id: d.id as string, video_url: d.video_url as string | null });
    }
    for (const h of unlinked as { id: string; title: string }[]) {
      const match = byTitle.get(normalizeTitle(h.title));
      if (!match) continue;
      const update: { drill_id: string; video_url?: string } = { drill_id: match.id };
      if (match.video_url) update.video_url = match.video_url;
      const { error } = await admin.from("elite_homework").update(update).eq("id", h.id);
      if (!error && match.video_url) fixed++;
    }
  }

  return fixed;
}

export async function getProgress(playerId: string): Promise<Progress[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId)) return DEMO_PROGRESS.filter((p) => p.player_id === playerId);
  const { data } = await supabase
    .from("elite_progress")
    .select("*")
    .eq("player_id", playerId);
  return (data as Progress[] | null) ?? [];
}

export async function getFilm(playerId: string): Promise<FilmUpload[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId))
    return DEMO_FILM.filter((f) => f.player_id === playerId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  const { data } = await supabase
    .from("elite_film_uploads")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  return (data as FilmUpload[] | null) ?? [];
}

export async function getNotes(playerId: string): Promise<CoachNote[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId))
    return DEMO_NOTES.filter((n) => n.player_id === playerId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  const { data } = await supabase
    .from("elite_coach_notes")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  return (data as CoachNote[] | null) ?? [];
}

// A player's 1:1 coaching calls (029), newest first. Demo players have
// none - the tour doesn't cover calls.
export async function getCoachingCalls(playerId: string): Promise<CoachingCall[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId)) return [];
  const { data, error } = await supabase
    .from("elite_coaching_calls")
    .select("*")
    .eq("player_id", playerId)
    .order("scheduled_at", { ascending: false });
  if (error) return []; // 029 not applied yet
  return (data as CoachingCall[] | null) ?? [];
}

// The coach's notes from the most recent calls, as one block the plan
// builder can read. What Coach Yinka and Gary said on a Zoom call is the
// strongest steer a plan can get, so both the Sunday cron and the manual
// generator feed it in. Empty when there are no noted calls.
export async function latestCoachingCallNotes(
  playerId: string,
  admin?: SupabaseClient,
  limit = 2
): Promise<string> {
  const client = admin ?? createClient();
  if (!client || isDemo(playerId)) return "";
  const { data, error } = await client
    .from("elite_coaching_calls")
    .select("scheduled_at, coach_name, notes")
    .eq("player_id", playerId)
    .neq("notes", "")
    .order("scheduled_at", { ascending: false })
    .limit(limit);
  if (error || !data || data.length === 0) return "";
  return (data as { scheduled_at: string; coach_name: string; notes: string }[])
    .map((c) => {
      const when = new Date(c.scheduled_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/New_York",
      });
      const who = c.coach_name ? ` with ${c.coach_name}` : "";
      return `${when}${who}: ${c.notes.trim()}`;
    })
    .join(" | ");
}

export async function getMessages(playerId: string): Promise<Message[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId))
    return DEMO_MESSAGES.filter((m) => m.player_id === playerId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  const { data } = await supabase
    .from("elite_messages")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  return (data as Message[] | null) ?? [];
}

export async function getAchievements(playerId: string): Promise<Achievement[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId))
    return DEMO_ACHIEVEMENTS.filter((a) => a.player_id === playerId).sort(
      (a, b) => b.earned_at.localeCompare(a.earned_at)
    );
  const { data } = await supabase
    .from("elite_achievements")
    .select("*")
    .eq("player_id", playerId)
    .order("earned_at", { ascending: false });
  return (data as Achievement[] | null) ?? [];
}

export async function getParentReports(
  playerId: string
): Promise<ParentReport[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId))
    return DEMO_PARENT_REPORTS.filter((r) => r.player_id === playerId).sort(
      (a, b) => b.created_at.localeCompare(a.created_at)
    );
  const { data } = await supabase
    .from("elite_parent_reports")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  return (data as ParentReport[] | null) ?? [];
}

export async function getGames(playerId: string): Promise<Game[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId))
    return DEMO_GAMES.filter((g) => g.player_id === playerId).sort((a, b) =>
      a.game_date.localeCompare(b.game_date)
    );
  const { data, error } = await supabase
    .from("elite_games")
    .select("*")
    .eq("player_id", playerId)
    .order("game_date", { ascending: true });
  if (error) return []; // table not created yet (pre-016)
  return (data as Game[] | null) ?? [];
}

export async function getCheckins(playerId: string): Promise<Checkin[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId))
    return DEMO_CHECKINS.filter((c) => c.player_id === playerId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  const { data, error } = await supabase
    .from("elite_checkins")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  if (error) return []; // table not created yet (pre-012)
  return (data as Checkin[] | null) ?? [];
}

export async function getWeeklyPlans(playerId: string): Promise<WeeklyPlan[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId))
    return DEMO_WEEKLY_PLANS.filter((p) => p.player_id === playerId).sort(
      (a, b) => b.week - a.week
    );
  const { data } = await supabase
    .from("elite_weekly_plans")
    .select("*")
    .eq("player_id", playerId)
    .order("week", { ascending: false });
  return (data as WeeklyPlan[] | null) ?? [];
}

export async function getProgressHistory(
  playerId: string
): Promise<ProgressPoint[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId)) {
    // demo: synthesize a gentle upward trend from current values
    return DEMO_PROGRESS.filter((p) => p.player_id === playerId).flatMap((p) =>
      [4, 2, 0].map((back, i) => ({
        id: `${p.id}-h${i}`,
        player_id: p.player_id,
        metric: p.metric,
        value: Math.max(0, p.value - back * 3),
        week: 7 - back,
        created_at: new Date(Date.now() - back * 7 * 864e5).toISOString(),
      }))
    );
  }
  const { data, error } = await supabase
    .from("elite_progress_history")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: true });
  if (error) return []; // pre-011
  return (data as ProgressPoint[] | null) ?? [];
}

// ---------------------------------------------------------------------------
// Player-loop metrics
// ---------------------------------------------------------------------------

const DEFAULT_DRILL_MIN = 15;

function nyDay(iso: string): string {
  // America/New_York local calendar date, YYYY-MM-DD.
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Pure TS equivalent of the elite_player_summary RPC - used in demo mode and
// as a fallback before 009_player_loop.sql is applied.
export function computeSummary(hw: Homework[]): PlayerSummary {
  const completed = hw.filter((h) => h.completed && h.completed_at);

  // streak: consecutive NY days ending today or yesterday
  const days = new Set(completed.map((h) => nyDay(h.completed_at as string)));
  const todayNY = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  let cursor = days.has(todayNY) ? todayNY : shiftDay(todayNY, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }

  // sessions: each (week, session) where every assigned drill is completed
  const bySession = new Map<string, { total: number; done: number }>();
  for (const h of hw) {
    const key = `${h.week}:${h.session ?? 1}`;
    const w = bySession.get(key) ?? { total: 0, done: 0 };
    w.total++;
    if (h.completed) w.done++;
    bySession.set(key, w);
  }
  let sessions = 0;
  for (const w of bySession.values())
    if (w.total > 0 && w.done === w.total) sessions++;

  const total = hw.length;
  const done = completed.length;
  const minutes = completed.reduce(
    (s, h) => s + (h.duration_min ?? DEFAULT_DRILL_MIN),
    0
  );
  const lastActive = completed.reduce<string | null>(
    (m, h) => (!m || (h.completed_at as string) > m ? (h.completed_at as string) : m),
    null
  );

  return {
    current_streak: streak,
    sessions_completed: sessions,
    homework_total: total,
    homework_completed: done,
    homework_pct: total > 0 ? Math.round((done / total) * 100) : 0,
    training_minutes: minutes,
    last_active: lastActive,
  };
}

export async function getPlayerSummary(playerId: string): Promise<PlayerSummary> {
  const supabase = createClient();
  if (supabase && !isDemo(playerId)) {
    const { data, error } = await supabase.rpc("elite_player_summary", {
      p_player_id: playerId,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row) {
      return {
        current_streak: row.current_streak ?? 0,
        sessions_completed: row.sessions_completed ?? 0,
        homework_total: row.homework_total ?? 0,
        homework_completed: row.homework_completed ?? 0,
        homework_pct: row.homework_pct ?? 0,
        training_minutes: row.training_minutes ?? 0,
        last_active: row.last_active ?? null,
      };
    }
  }
  // fallback (demo / pre-migration)
  return computeSummary(await getHomework(playerId));
}

export async function getNotifications(
  playerId: string
): Promise<EliteNotification[]> {
  const supabase = createClient();
  if (!supabase || isDemo(playerId)) {
    // demo: one sample unread notification so the bell is visible
    return [
      {
        id: "demo-notif-1",
        player_id: playerId,
        kind: "new_week",
        title: "Week 7 is ready",
        body: "Own your 1v1. Sell the fake, explode past.",
        read: false,
        created_at: new Date().toISOString(),
      },
    ];
  }
  const { data, error } = await supabase
    .from("elite_notifications")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return []; // table not created yet
  return (data as EliteNotification[] | null) ?? [];
}

export async function getCoachRoster(): Promise<RosterRow[]> {
  const supabase = createClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("elite_coach_roster");
    if (!error && Array.isArray(data)) {
      return data as RosterRow[];
    }
    // fallback: per-player compute (pre-migration)
    const players = await getPlayers();
    return Promise.all(
      players.map(async (p) => {
        const s = computeSummary(await getHomework(p.id));
        return {
          player_id: p.id,
          full_name: p.full_name,
          avatar_color: p.avatar_color,
          current_week: p.current_week,
          subscription_status: p.subscription_status,
          last_active: s.last_active,
          current_streak: s.current_streak,
          homework_pct: s.homework_pct,
          training_minutes: s.training_minutes,
          sessions_completed: s.sessions_completed,
        };
      })
    );
  }
  // demo
  return Promise.all(
    DEMO_PLAYERS.map(async (p) => {
      const s = computeSummary(await getHomework(p.id));
      return {
        player_id: p.id,
        full_name: p.full_name,
        avatar_color: p.avatar_color,
        current_week: p.current_week,
        subscription_status: p.subscription_status,
        last_active: s.last_active,
        current_streak: s.current_streak,
        homework_pct: s.homework_pct,
        training_minutes: s.training_minutes,
        sessions_completed: s.sessions_completed,
      };
    })
  );
}

// What needs the coach's attention: unanswered check-ins and unread player
// messages, per player. RLS scopes rows to the coach's own players.
export type CoachInbox = {
  pendingCheckins: number;
  unreadMessages: number;
  byPlayer: Record<string, { checkins: number; messages: number }>;
};

export async function getCoachInbox(): Promise<CoachInbox> {
  const empty: CoachInbox = {
    pendingCheckins: 0,
    unreadMessages: 0,
    byPlayer: {},
  };
  const supabase = createClient();

  const bump = (
    inbox: CoachInbox,
    playerId: string,
    field: "checkins" | "messages"
  ) => {
    const row = inbox.byPlayer[playerId] ?? { checkins: 0, messages: 0 };
    row[field]++;
    inbox.byPlayer[playerId] = row;
    if (field === "checkins") inbox.pendingCheckins++;
    else inbox.unreadMessages++;
  };

  if (!supabase) {
    // demo: derive from the demo dataset
    const inbox: CoachInbox = { ...empty, byPlayer: {} };
    for (const c of DEMO_CHECKINS)
      if (!c.coach_feedback) bump(inbox, c.player_id, "checkins");
    for (const m of DEMO_MESSAGES)
      if (m.from_role === "player" && !m.read)
        bump(inbox, m.player_id, "messages");
    return inbox;
  }

  const inbox: CoachInbox = { ...empty, byPlayer: {} };
  const { data: checkins } = await supabase
    .from("elite_checkins")
    .select("player_id, coach_feedback")
    .or("coach_feedback.is.null,coach_feedback.eq.");
  for (const c of (checkins as { player_id: string }[] | null) ?? [])
    bump(inbox, c.player_id, "checkins");

  const { data: msgs } = await supabase
    .from("elite_messages")
    .select("player_id, from_role, read")
    .eq("from_role", "player")
    .eq("read", false);
  for (const m of (msgs as { player_id: string }[] | null) ?? [])
    bump(inbox, m.player_id, "messages");

  return inbox;
}

// Derived stats used across the dashboards.
export function homeworkCompletion(hw: Homework[]): number {
  if (!hw.length) return 0;
  return Math.round((hw.filter((h) => h.completed).length / hw.length) * 100);
}

export function overallProgress(progress: Progress[]): number {
  if (!progress.length) return 0;
  return Math.round(
    progress.reduce((s, p) => s + p.value, 0) / progress.length
  );
}
