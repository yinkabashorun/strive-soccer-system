// Strive Elite domain model. Mirrors the Supabase schema in
// supabase/migrations/005_strive_elite.sql. All ids are strings (uuid in
// production, stable slugs in demo data).

export type Role = "coach" | "player" | "admin";

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  avatar_color: string;
};

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "none";

export type PlayerLevel = "Developing" | "Competitive" | "Advanced" | "Elite";

export type Player = {
  id: string;
  profile_id: string;
  coach_id: string;
  full_name: string;
  avatar_color: string;
  age: number;
  position: string;
  level: PlayerLevel;
  current_week: number;
  today_focus: string;
  goals: string[];
  strengths: string[];
  weaknesses: string[];
  parent_name: string;
  parent_email: string;
  next_session_at: string | null; // ISO
  last_session_at: string | null; // ISO
  joined_at: string;
  subscription_status: SubscriptionStatus;
  // Intake + AI memory (012_intake_memory_checkins)
  club?: string;
  dominant_foot?: string;
  self_assessment?: Partial<Record<ProgressMetric, number>>; // 0-100 self ratings
  coach_memory?: string; // coach's freeform memory note, always fed to the AI
  // Training environment (019): what the player can actually train with.
  // null/undefined = never asked; the AI treats that as "no wall, no goal".
  has_wall?: boolean | null;
  has_goal?: boolean | null;
  onboarded_at?: string | null; // ISO; null = intake not completed yet
  week1_monday?: string | null; // NY Monday the program clock started (014)
};

// A player's structured weekly check-in (elite_checkins).
export type Checkin = {
  id: string;
  player_id: string;
  week: number;
  rating: number | null; // 1-5, how the week went
  energy: number | null; // 1-5
  went_well: string;
  struggled: string;
  note: string;
  coach_feedback: string;
  coach_feedback_at: string | null;
  created_at: string;
};

export type Homework = {
  id: string;
  player_id: string;
  week: number;
  session?: number; // 1..4 - which of the week's four sessions (010 adds the column)
  title: string;
  exercise: string;
  reps: string;
  duration_min?: number; // minutes for this drill (009_player_loop adds the column)
  video_url: string | null;
  notes: string | null;
  completed: boolean;
  completed_at: string | null;
  sort: number;
};

// Rolled-up player-loop metrics (elite_player_summary RPC / TS fallback).
export type PlayerSummary = {
  current_streak: number; // consecutive America/New_York days with >=1 done
  sessions_completed: number; // weeks fully completed
  homework_total: number;
  homework_completed: number;
  homework_pct: number; // 0-100
  training_minutes: number; // sum of duration_min over completed drills
  last_active: string | null; // ISO of most recent completion
};

// In-app notification (elite_notifications).
export type EliteNotification = {
  id: string;
  player_id: string;
  kind: string; // e.g. "new_week"
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

// One roster row for the coach (elite_coach_roster RPC / TS fallback).
export type RosterRow = {
  player_id: string;
  full_name: string;
  avatar_color: string;
  current_week: number;
  subscription_status: SubscriptionStatus;
  last_active: string | null;
  current_streak: number;
  homework_pct: number;
  training_minutes: number;
  sessions_completed: number;
};

// The seven tracked development pillars.
export const PROGRESS_METRICS = [
  "Ball Mastery",
  "Weak Foot",
  "Passing",
  "Scanning",
  "Decision Making",
  "Confidence",
  "Speed",
] as const;

export type ProgressMetric = (typeof PROGRESS_METRICS)[number];

export type Progress = {
  id: string;
  player_id: string;
  metric: ProgressMetric;
  value: number; // 0-100
  prev_value: number; // previous rating, for trend deltas
  updated_at: string;
};

// One historical rating point (elite_progress_history) - powers the
// season-long trend + AI memory.
export type ProgressPoint = {
  id: string;
  player_id: string;
  metric: ProgressMetric;
  value: number;
  week: number;
  created_at: string;
};

// A timestamped moment inside a film breakdown. kind marks it as a
// highlight to keep ("good") or a teaching point ("fix").
export type FilmMoment = {
  time: string; // "12:30" - mm:ss into the video
  note: string;
  kind: "good" | "fix";
};

// The coach's structured monthly film analysis (elite_film_uploads.review,
// 017). coach_notes keeps the summary so pre-017 rows and older clients
// still render something.
export type FilmReview = {
  summary: string; // the big picture, in the coach's voice
  moments: FilmMoment[]; // timestamped key moments
  strengths: string[]; // what's working
  fixes: string[]; // what we're fixing
  next_steps: string[]; // marching orders for the next block
};

export type FilmUpload = {
  id: string;
  player_id: string;
  title: string;
  url: string | null;
  thumbnail: string | null;
  coach_notes: string | null;
  status: "Uploaded" | "Reviewed" | "Analyzing";
  created_at: string;
  month?: number; // program month (1, 2, 3…) - one review per month (015)
  review?: FilmReview | null; // structured breakdown (017)
};

// An upcoming game the player posted (elite_games) - the coach can mark
// attendance for Northern Virginia games.
export type Game = {
  id: string;
  player_id: string;
  game_date: string; // YYYY-MM-DD
  kickoff: string;
  opponent: string;
  location: string;
  notes: string;
  coach_attending: boolean;
  created_at: string;
};

export type CoachNote = {
  id: string;
  player_id: string;
  body: string;
  created_at: string;
};

export type Message = {
  id: string;
  player_id: string;
  from_role: Role;
  from_name: string;
  body: string;
  created_at: string;
  read: boolean;
};

export type WeeklyPlan = {
  id: string;
  player_id: string;
  week: number;
  focus: string;
  objectives: string[];
  homework: { title: string; exercise: string; reps: string }[];
  created_at: string;
  unlocks_at?: string | null; // when this week goes live (014)
  notified?: boolean; // unlock notification already sent
};

export type ParentReport = {
  id: string;
  player_id: string;
  summary: string;
  improvement: string;
  homework: string;
  next_focus: string;
  created_at: string;
};

// A single drill inside a session.
export type GeneratedDrill = {
  title: string;
  exercise: string;
  reps: string;
  minutes?: number;
  notes?: string;
};

// One of the week's four sessions.
export type GeneratedSession = {
  title: string;
  drills: GeneratedDrill[];
};

// The structured object Claude returns from raw session notes. A week is
// FOUR sessions; each one starts with a plyometric warm-up (guaranteed
// server-side).
export type GeneratedPlan = {
  weekly_focus: string;
  sessions: GeneratedSession[];
  parent_update: string;
  player_summary: string;
  progress_updates: { metric: ProgressMetric; value: number }[];
  next_week_objectives: string[];
};

export type Achievement = {
  id: string;
  player_id: string;
  title: string;
  detail: string;
  icon: string; // lucide icon name
  earned_at: string;
};
