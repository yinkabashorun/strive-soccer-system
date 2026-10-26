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

// The two offers (029). Strive Elite is the app; Complete Pathway is the
// app plus film, the parent report, and weekly 1:1 coaching calls.
export type MembershipTier = "elite" | "complete";

// A scheduled 1:1 coaching call (elite_coaching_calls, 029). Booking
// happens on Calendly; this is what the app knows about it, plus the
// coach's note afterward, which feeds the next weekly plan.
export type CoachingCall = {
  id: string;
  player_id: string;
  scheduled_at: string; // ISO
  join_url: string;
  coach_name: string;
  notes: string;
  created_at: string;
};

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
  parent_phone?: string | null; // SMS contact (025), captured at signup + confirmed at intake
  player_phone?: string | null; // player's own phone (026), optional - lets the player text directly and matches inbound replies to the right role
  gender?: "boy" | "girl" | null; // (027) required at onboarding going forward, coach-editable for existing players - lets AI copy use correct pronouns
  next_session_at: string | null; // ISO
  last_session_at: string | null; // ISO
  joined_at: string;
  subscription_status: SubscriptionStatus;
  // (029) which offer they're on. "elite" = the app only. "complete" adds
  // Film Room, the monthly breakdown, the weekly parent report, and 1:1
  // coaching calls. Absent on demo data / pre-029 rows = treated as complete.
  tier?: MembershipTier | null;
  // Intake + AI memory (012_intake_memory_checkins)
  club?: string;
  dominant_foot?: string;
  self_assessment?: Partial<Record<ProgressMetric, number>>; // 0-100 self ratings
  coach_memory?: string; // coach's freeform memory note, always fed to the AI
  // Training environment (019): what the player can actually train with.
  // null/undefined = never asked; the AI treats that as "no wall, no goal".
  has_wall?: boolean | null;
  has_goal?: boolean | null;
  // Offer stack item 1 (033). Absent on demo / pre-033 rows = in_season,
  // open: exactly today's four-session week with no space filtering.
  training_load?: TrainingLoad | null;
  space?: TrainingSpace | null;
  // Bi-weekly progress video (037): the one drill filmed every second
  // week. null = the app uses the first skill drill they ever completed.
  benchmark_drill_id?: string | null;
  // Course drills offered per player (040): the coach switches the player
  // on and ticks which opt-in bank drills the builder may use for them.
  // Absent / false / empty = none, exactly today's week.
  offer_opt_in?: boolean | null;
  opt_in_drill_ids?: string[] | null;
  onboarded_at?: string | null; // ISO; null = intake not completed yet
  onboarding_reminder_sent_at?: string | null; // 025: last onboarding-nudge SMS
  week1_monday?: string | null; // NY Monday the program clock started (014)
};

// One drill in the coach's drill bank (elite_drills, 020). The AI composes
// weeks strictly from these; the coach owns them at /coach/drills.
export type Drill = {
  id: string;
  pillar: ProgressMetric | typeof PLYO_PILLAR | typeof STRENGTH_PILLAR;
  title: string;
  how: string;
  reps: string;
  minutes: number;
  cues: string;
  needs_wall: boolean;
  // 033: coach-ticked "works in a few yards" - the only drills a player
  // on the tight space setting is given. Absent/false = open space only.
  small_space?: boolean;
  // 040: a course drill. Never enters a week on its own; only when the
  // coach offers it to that player (Player.offer_opt_in + opt_in_drill_ids).
  opt_in?: boolean;
  active: boolean;
  sort: number;
  // 021: demo video + credit ("" = none)
  video_url?: string;
  demo_by?: string;
};

// A hand-built session for players with a ball and a few yards (035,
// elite_session_templates + elite_session_template_drills). drills is the
// coach's ordered pick of SKILL drills; the plyo warm-up and any required
// strengthening finisher are added by the system, same as every session.
export type SessionTemplate = {
  id: string;
  title: string;
  space: TrainingSpace;
  sort: number;
  active: boolean;
  drills: Drill[];
};

// Courses (041, Oct 26 2026): a named ladder of steps grouped into levels,
// shown to every member on the Courses tab as a library (nothing
// tracked). A drill course's steps are bank drills by id; a lesson
// course's steps are pages. One step is one or the other, never both.
export type CourseKind = "drill" | "lesson";
export type CourseTag = "beginner" | "advanced";
export type CourseStep = {
  id: string;
  course_id: string;
  level_no: number;
  level_name: string | null;
  tag: CourseTag | null;
  drill_id: string | null;
  drill?: Drill | null; // joined bank row for a drill step
  title: string | null; // lesson steps
  body: string | null;
  video_url: string | null;
  download_url: string | null;
  cue: string | null;
  pass_mark: string | null;
  sort: number;
};
export type Course = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  intro: string | null;
  kind: CourseKind;
  active: boolean;
  sort: number;
  steps: CourseStep[];
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
  session?: number; // 1..N - which of the week's sessions (010 adds the column; N is the player's load, 033)
  is_extra?: boolean; // 033: an Extra Work session the player added on top of the plan
  title: string;
  exercise: string;
  reps: string;
  duration_min?: number; // minutes for this drill (009_player_loop adds the column)
  video_url: string | null;
  drill_id?: string | null; // (028) stable link to elite_drills - video updates flow through this, not title text
  pillar?: string | null; // (034) the linked drill's pillar, filled by the database from drill_id - powers minutes-by-pillar for the player
  template_id?: string | null; // (035) the few-yards template this row came from; null for composed rows
  notes: string | null;
  completed: boolean;
  completed_at: string | null;
  sort: number;
};

// One progress video (elite_progress_videos, 037): the same drill filmed
// every second week. clip_url is a short-lived signed URL at read time.
export type ProgressVideo = {
  id: string;
  player_id: string;
  week: number;
  drill_id: string | null;
  drill_title: string;
  clip_path: string;
  share_ok: boolean;
  parent_sent_at: string | null;
  posted_at: string | null;
  created_at: string;
  clip_url?: string | null;
};

// One break from training (elite_training_breaks, 034). since/until are
// NY calendar dates, inclusive. resumed_at is stamped once the program
// clock has been moved on return (lib/elite/breaks.ts settleBreaks), so a
// break is settled exactly once. History is never deleted.
export type TrainingBreak = {
  id: string;
  player_id: string;
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
  note: string;
  created_by: "player" | "coach";
  resumed_at: string | null;
  created_at: string;
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

// Offer stack item 1 (033): how much a player trains and where.
//   in_season  = 4 sessions x 40 min, layered on 3-4 team practices (default)
//   off_season = 6 sessions x 40 min, for the player with more in the tank
//   open       = yard, driveway, park or garage (default)
//   tight      = a ball and a few yards: only small_space bank drills
export type TrainingLoad = "in_season" | "off_season";
export type TrainingSpace = "open" | "tight";

// Drill-bank pillar for plyometric warm-ups. Not a tracked progress metric:
// every session opens with one automatically, so the AI never prescribes
// them as skill drills and players aren't rated on them.
export const PLYO_PILLAR = "Plyo";

// Drill-bank pillar for strengthening / injury-prevention finishers (core,
// hips, glutes, groin). Also not a rated metric. A strengthening drill is
// always the LAST drill of a session, at most one per session, and is
// REQUIRED in every session when the coach's note or the player's own
// words mention an injury, rehab, prevention, core, hip or strength work
// (lib/elite/bank-conform.ts strengthRequired). Otherwise the builder may
// add one to a couple of sessions a week. Added Oct 7 2026 for the first
// player training through a lower-back injury.
export const STRENGTH_PILLAR = "Strengthening";

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
  // Send a clip (036): the storage object and the drill it shows. clip_url
  // is derived at read time (a short-lived signed URL), never stored.
  clip_path?: string | null;
  clip_label?: string;
  clip_url?: string | null;
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

// One of the week's sessions.
export type GeneratedSession = {
  title: string;
  drills: GeneratedDrill[];
  template_id?: string; // (035) set when the session IS a few-yards template
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

// One run of a background job (030). The coach dashboard shows the latest
// plan-builder row so a run that did nothing is never invisible.
export type CronRun = {
  id: string;
  job: string;
  ran_at: string;
  trigger: "cron" | "coach" | "skipped";
  authed: boolean;
  built: number;
  skipped: number;
  errors: { name: string; error: string }[];
  issues: { name: string; issue: string }[]; // live-week audit (031)
  summary: string;
  finished: boolean; // false = started, never completed (crash/timeout)
};

// One error page somebody saw (039). Written by /api/elite/errors from
// the error boundaries; the coach dashboard shows the last 7 days.
export type AppError = {
  id: string;
  occurred_at: string;
  side: "client" | "server";
  route: string;
  digest: string | null; // Next's digest for a server error
  message: string;
  stack: string | null; // client errors only
  viewer_role: Role | null;
  player_id: string | null;
  user_agent: string | null;
};
