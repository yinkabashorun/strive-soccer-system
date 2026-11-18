// The free training log: the pure rules (Nov 18 2026, migration 069).
//
// A free account logs the training a player does on their own, against a
// weekly target, and shares the week. Nothing else: no drills, no
// courses, no plan. Coach Yinka's rule for it: "super simplified, even if
// we have to remove ideas". Whatever is not needed to log, see the week
// or share it is not here.
//
// What this file will never grow: a streak, a count of days missed, a
// board comparing players, or a score. The one number is time trained.
import { fmtDuration } from "./time-trained";
import { shiftDay } from "./time";
import type { Role } from "./types";

// ---- The four quiz answers --------------------------------------------

// Asked first. It is the player's age band, and the one thing that
// decides whether they log gym work (tracksGym). Level is about the team
// and never about age: an ECNL player in high school picks "High school"
// here and "ECNL, MLS NEXT or similar" there.
export const GRADES = [
  { id: "middle_or_younger", label: "Middle school or younger" },
  { id: "high_school", label: "High school" },
  { id: "college_or_older", label: "College or older" },
] as const;

export const LEVELS = [
  { id: "rec", label: "Rec or town team" },
  { id: "travel", label: "Travel or club team" },
  { id: "elite", label: "ECNL, MLS NEXT or similar" },
  { id: "high_school", label: "High school team only" },
  { id: "college", label: "College team" },
] as const;

export const SEASONS = [
  { id: "in_season", label: "In season", detail: "Team training and games most weeks" },
  { id: "off_season", label: "Off season", detail: "Little or no team training right now" },
] as const;

export const GOALS = [
  { id: "start", label: "Start for my team" },
  { id: "higher_team", label: "Make a higher team" },
  { id: "college", label: "Play in college" },
  { id: "pro", label: "Go pro" },
] as const;

export type Grade = (typeof GRADES)[number]["id"];
export type Level = (typeof LEVELS)[number]["id"];
export type Season = (typeof SEASONS)[number]["id"];
export type Goal = (typeof GOALS)[number]["id"];

export type QuizAnswers = { grade: Grade; level: Level; season: Season; goal: Goal };

// The questions, in the order they are asked.
export const QUIZ_QUESTIONS = ["grade", "level", "season", "goal"] as const;

const idIn = <T extends { id: string }>(list: readonly T[], v: unknown): v is T["id"] =>
  typeof v === "string" && list.some((x) => x.id === v);

// The quiz is four taps. Anything else is refused.
export function validateQuiz(input: {
  grade?: unknown;
  level?: unknown;
  season?: unknown;
  goal?: unknown;
}): QuizAnswers | null {
  if (
    !idIn(GRADES, input.grade) ||
    !idIn(LEVELS, input.level) ||
    !idIn(SEASONS, input.season) ||
    !idIn(GOALS, input.goal)
  ) {
    return null;
  }
  return { grade: input.grade, level: input.level, season: input.season, goal: input.goal };
}

export const labelOf = <T extends { id: string; label: string }>(
  list: readonly T[],
  id: string | null | undefined
): string => list.find((x) => x.id === id)?.label ?? "";

// ---- The weekly target ------------------------------------------------

// The recommended target, by season (elite_target_table). `max` is set
// when the recommendation is a range.
export type TargetRow = { season: Season; minutes: number; minutes_max: number | null };

// Coach Yinka's numbers (Nov 18 2026), also the seed of migration 069:
// in season 4 extra hours a week; off season 6 to 12 hours a week. Used
// only when the table cannot be read.
export const DEFAULT_TARGETS: TargetRow[] = [
  { season: "in_season", minutes: 240, minutes_max: null },
  { season: "off_season", minutes: 360, minutes_max: 720 },
];

export function recommendation(table: TargetRow[], season: Season): TargetRow {
  return (
    table.find((r) => r.season === season) ??
    DEFAULT_TARGETS.find((r) => r.season === season)!
  );
}

// A target is set in half-hour steps.
export const TARGET_STEP = 30;
export const TARGET_MIN = 30;
export const TARGET_MAX = 2400;

export function cleanTarget(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const stepped = Math.round(n / TARGET_STEP) * TARGET_STEP;
  if (stepped < TARGET_MIN || stepped > TARGET_MAX) return null;
  return stepped;
}

export function stepTarget(current: number, direction: 1 | -1): number {
  const next = current + direction * TARGET_STEP;
  return Math.min(TARGET_MAX, Math.max(TARGET_MIN, next));
}

// "4 hours" when it is whole hours, otherwise "4h 30m".
function hoursWords(minutes: number): string {
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  return fmtDuration(minutes);
}

function rangeWords(row: TargetRow): string {
  if (!row.minutes_max) return hoursWords(row.minutes);
  if (row.minutes % 60 === 0 && row.minutes_max % 60 === 0) {
    return `${row.minutes / 60} to ${row.minutes_max / 60} hours`;
  }
  return `${fmtDuration(row.minutes)} to ${fmtDuration(row.minutes_max)}`;
}

// What the player reads after the quiz. In season it is on top of team
// training, so it says so.
export function recommendLine(row: TargetRow): string {
  const tail = row.season === "in_season" ? ", outside team training" : "";
  return `We recommend ${rangeWords(row)} a week on your own${tail}.`;
}

// ---- Logging ----------------------------------------------------------

// One tap logs one of these.
export const LOG_CHIPS = [15, 30, 45, 60, 90] as const;
export const LOG_MAX_MINUTES = 300;

// Gym work is tracked apart from training (Coach Yinka, Nov 18 2026). The
// weekly target and the ring are training only; gym has no target.
export const KINDS = [
  { id: "training", label: "Training" },
  { id: "gym", label: "Gym" },
] as const;
export type Kind = (typeof KINDS)[number]["id"];

export function cleanKind(raw: unknown): Kind | null {
  return raw === "training" || raw === "gym" ? raw : null;
}

// Gym is for older players only: in high school, or in college or older.
// It is read from the GRADE the player gave, never from the team they
// play for (a high school player on an ECNL team tracks gym).
export function tracksGym(grade: string | null | undefined): boolean {
  return grade === "high_school" || grade === "college_or_older";
}

// May this player log this kind? Training, always. Gym, only an older
// player. The server action asks this before anything is written.
export function mayLog(kind: Kind, grade: string | null | undefined): boolean {
  return kind === "training" || tracksGym(grade);
}

export const GYM_REFUSED_MESSAGE = "Gym work is logged by players in high school or older.";

export type TrainingLog = {
  id: string;
  trained_on: string;
  minutes: number;
  kind: Kind;
  created_at?: string;
};

export function validateMinutes(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > LOG_MAX_MINUTES) return null;
  return n;
}

// ---- The week (Monday to Sunday, New York) -----------------------------

function mondayIndex(day: string): number {
  const js = new Date(day + "T00:00:00Z").getUTCDay(); // 0 = Sunday
  return (js + 6) % 7;
}

export function weekOf(today: string): { monday: string; sunday: string } {
  const monday = shiftDay(today, -mondayIndex(today));
  return { monday, sunday: shiftDay(monday, 6) };
}

export function logsThisWeek(logs: TrainingLog[], today: string): TrainingLog[] {
  const { monday, sunday } = weekOf(today);
  return logs.filter((l) => l.trained_on >= monday && l.trained_on <= sunday);
}

const sumOf = (logs: { minutes: number; kind: Kind }[], kind: Kind) =>
  logs.reduce((s, l) => (l.kind === kind ? s + l.minutes : s), 0);

export type WeekProgress = {
  minutes: number; // training this week, never capped
  gymMinutes: number; // gym this week, apart
  target: number;
  percent: number; // 0 to 100, for the ring only: training against the target
};

// Gym never fills the ring: the percent is training alone.
export function weekProgress(logs: TrainingLog[], target: number, today: string): WeekProgress {
  const week = logsThisWeek(logs, today);
  const minutes = sumOf(week, "training");
  const percent = target > 0 ? Math.min(100, Math.round((minutes / target) * 100)) : 0;
  return { minutes, gymMinutes: sumOf(week, "gym"), target, percent };
}

// All time is training hours. Gym is counted on its own.
export function allTimeMinutes(logs: { minutes: number; kind: Kind }[]): number {
  return sumOf(logs, "training");
}

export function gymThisWeekLine(gymMinutes: number): string | null {
  return gymMinutes > 0 ? `Gym this week: ${fmtDuration(gymMinutes)}` : null;
}

const SHORT_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "Nov 16" for a YYYY-MM-DD day.
export function shortDate(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  return `${SHORT_MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// "Mon, Nov 16"
export function dayLabel(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  return `${SHORT_DAY[d.getUTCDay()]}, ${shortDate(day)}`;
}

// "Nov 16 to Nov 22"
export function weekLabel(today: string): string {
  const { monday, sunday } = weekOf(today);
  return `${shortDate(monday)} to ${shortDate(sunday)}`;
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

// ---- The weekly card --------------------------------------------------

// Everything on the card: the time trained this week, the dates, the
// first name, and one small gym line when gym was logged this week. The
// wordmark and the handle are fixed. Nothing else.
export type CardFacts = { time: string; week: string; name: string; gym: string | null };
export const CARD_HANDLE = "@strivesoccerfc";

export function cardFacts(input: { fullName: string; logs: TrainingLog[]; today: string }): CardFacts {
  const week = weekProgress(input.logs, 0, input.today);
  return {
    time: fmtDuration(week.minutes),
    week: weekLabel(input.today),
    name: firstNameOf(input.fullName),
    gym: week.gymMinutes > 0 ? `Gym ${fmtDuration(week.gymMinutes)}` : null,
  };
}

// ---- The link a player shares -----------------------------------------

// Eight characters, none that can be misread (no 0, O, 1, I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REFERRAL_CODE_LENGTH = 8;

export function newReferralCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
  }
  return out;
}

// The code from a link, or null when it is not one. A bad code never
// stops anyone from joining; it is simply not counted.
export function cleanReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return new RegExp(`^[${CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`).test(code) ? code : null;
}

export function joinLink(appUrl: string, code: string): string {
  return `${appUrl.replace(/\/+$/, "")}/join?ref=${code}`;
}

export function joinedLine(count: number): string {
  if (count <= 0) return "No one has joined with your link yet.";
  return count === 1
    ? "1 teammate joined with your link."
    : `${count} teammates joined with your link.`;
}

// ---- Joining ----------------------------------------------------------

export const JOIN_CLOSED_MESSAGE = "Sign-up is not open yet. If you already have an account, sign in.";
export const JOIN_FIELDS_MESSAGE =
  "Enter your first and last name, your email, a phone number, and a password of at least 8 characters.";

export type JoinFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
};

export function cleanJoin(input: {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
}): JoinFields | null {
  const text = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
  const firstName = text(input.firstName);
  const lastName = text(input.lastName);
  const email = text(input.email).toLowerCase();
  const phone = text(input.phone);
  const password = typeof input.password === "string" ? input.password : "";
  if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (phone.replace(/\D/g, "").length < 10) return null;
  if (password.length < 8) return null;
  return { firstName, lastName, email, phone, password };
}

// ---- Where a signed-in person belongs ---------------------------------

// One rule for the front door, the member shell and the Account page.
// Staff go to the coach side. A member (a player record exists) goes to
// the member app and never sees the free log. A free account goes to the
// log and never sees the member app. A player with neither waits on the
// member side, where the "Almost there" screen is.
export const FREE_HOME = "/log";
export const FREE_QUIZ = "/log/quiz";

// Where a free account opens: the week, or the four questions when they
// have not been answered yet. Sign-in, the front door and a brand-new
// account all use this, so getting there is a single redirect.
export function freeLanding(quizDone: boolean): string {
  return quizDone ? FREE_HOME : FREE_QUIZ;
}

export function homeFor(input: {
  role: Role;
  hasPlayer: boolean;
  // The free account behind this login, when there is one.
  tracker: { quizDone: boolean } | null;
}): string {
  if (input.role === "coach" || input.role === "admin") return "/coach";
  if (input.hasPlayer) return "/dashboard";
  return input.tracker ? freeLanding(input.tracker.quizDone) : "/dashboard";
}

// The one line at the bottom of the log about the coached program links
// to the public page about it. That page is never opened inside the App
// Store app, so there the line is not drawn at all.
export const PROGRAM_PAGE = "/demo";
export function programLink(inApp: boolean): string | null {
  return inApp ? null : PROGRAM_PAGE;
}

// An invite for an email that already holds a free account cannot make a
// second account, and there is no button yet that turns one into a
// membership. So the answer says what is true and who can sort it out.
export const FREE_ACCOUNT_EXISTS_MESSAGE =
  "This email already has a free training log account, so the invite cannot create a second one. Tell your coach and we will move you over.";

// What a free account agrees to, in three plain lines above the two
// boxes (the boxes themselves are the same as every account's:
// lib/elite/legal.ts). Written to the player, about what a free account
// actually stores.
export const FREE_AGREEMENT_POINTS: string[] = [
  "We store your profile, your quiz answers and the training you log.",
  "Some of that information is handled by the service providers named in the Privacy Policy.",
  "A coach may text or call the number you give us. Message and data rates may apply. Reply STOP to any text to end them.",
];
