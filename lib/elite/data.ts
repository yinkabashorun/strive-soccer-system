import { createClient } from "./supabase/server";
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
  Game,
  CoachNote,
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
  WeeklyPlan,
} from "./types";

// Server-side data access for Strive Elite. Reads from Supabase when
// configured, otherwise returns the demo dataset. The UI is identical in
// both modes so the deployed app is fully tourable before wiring Supabase.

// Demo-tour ids ("p-marcus"…) ALWAYS serve demo data — even in production
// with Supabase configured — so the login-page "tour the app" experience
// works everywhere and never touches real rows.
const DEMO_IDS = new Set(DEMO_PLAYERS.map((p) => p.id));
const isDemo = (id: string) => DEMO_IDS.has(id);

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

// Pure TS equivalent of the elite_player_summary RPC — used in demo mode and
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
        body: "Scan before you receive — two looks minimum.",
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
