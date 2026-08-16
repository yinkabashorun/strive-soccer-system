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
};

export type Homework = {
  id: string;
  player_id: string;
  week: number;
  session?: number; // 1..4 — which of the week's four sessions (010 adds the column)
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

export type FilmUpload = {
  id: string;
  player_id: string;
  title: string;
  url: string | null;
  thumbnail: string | null;
  coach_notes: string | null;
  status: "Uploaded" | "Reviewed" | "Analyzing";
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
