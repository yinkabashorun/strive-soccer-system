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
  title: string;
  exercise: string;
  reps: string;
  video_url: string | null;
  notes: string | null;
  completed: boolean;
  completed_at: string | null;
  sort: number;
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

// The structured object Claude returns from raw session notes.
export type GeneratedPlan = {
  weekly_focus: string;
  homework: { title: string; exercise: string; reps: string; notes?: string }[];
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
