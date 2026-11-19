// The free app: the pure rules (Nov 18 2026, migration 069).
//
// Coach Yinka's words for it: "a BeReal app for soccer players to share
// training to friends they have added on the app, then also the
// accountability piece". A player posts a photo of today's training with
// how long it was, sees the friends they added do the same, and keeps a
// week against a target on the days they planned. No drills, no courses,
// no plan from us. His rule for it: "super simplified, even if we have to
// remove ideas".
//
// What this file will never grow: a streak, a count of days missed, a
// score, or a board of all players. The one number is time trained, and
// the only people a player is ever shown next to are their own friends.
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
  photo?: boolean; // this entry is a post: it carries a photo friends can see
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

// ---- Planning the week ------------------------------------------------

// Days are numbered Monday 0 to Sunday 6, the same as the training week.
export const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export function dayIndexOf(day: string): number {
  return mondayIndex(day);
}

// The days a player picked: whole numbers 0 to 6, each once, in order. At
// least one day, or it is not a plan.
export function cleanPlanDays(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const days = new Set<number>();
  for (const v of raw) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 6) return null;
    days.add(n);
  }
  if (days.size === 0) return null;
  return [...days].sort((x, y) => x - y);
}

// The weekly target spread over the planned days, to the nearest five
// minutes. A guide for the day, never a mark to be judged against.
export function perDayMinutes(target: number, dayCount: number): number {
  if (dayCount <= 0 || target <= 0) return 0;
  return Math.max(5, Math.round(target / dayCount / 5) * 5);
}

// "4 days. About 1h a day."
export function splitLine(target: number, dayCount: number): string | null {
  if (dayCount <= 0) return null;
  const days = dayCount === 1 ? "1 day" : `${dayCount} days`;
  return `${days}. About ${fmtDuration(perDayMinutes(target, dayCount))} a day.`;
}

// "Mon, Wed, Fri"
export function planDaysLabel(days: number[]): string {
  return days.map((d) => DAY_SHORT[d]).join(", ");
}

// One mark of the seven-day strip under the ring. A planned day is
// outlined, a day with training logged is filled, today is marked. A
// planned day with nothing logged is only an outline: the strip never
// says a day was missed.
export type StripDay = {
  day: string; // YYYY-MM-DD
  index: number; // 0 = Monday
  letter: string;
  planned: boolean;
  trained: boolean;
  today: boolean;
  minutes: number; // training that day
};

export function weekStrip(logs: TrainingLog[], planDays: number[], today: string): StripDay[] {
  const { monday } = weekOf(today);
  return DAY_LETTERS.map((letter, index) => {
    const day = shiftDay(monday, index);
    const minutes = logs.reduce(
      (s, l) => (l.trained_on === day && l.kind === "training" ? s + l.minutes : s),
      0
    );
    return {
      day,
      index,
      letter,
      planned: planDays.includes(index),
      trained: minutes > 0,
      today: day === today,
      minutes,
    };
  });
}

// What a screen reader says for one mark of the strip.
export function stripDayLabel(d: StripDay): string {
  const what = d.trained
    ? `${fmtDuration(d.minutes)} trained`
    : d.planned
      ? "a training day"
      : "nothing planned";
  return `${DAY_NAMES[d.index]}, ${shortDate(d.day)}${d.today ? ", today" : ""}: ${what}`;
}

// The one line under the strip, in two parts so the first can be set
// heavier: "Trained today." then "Next up: Friday, about 1h." It only
// ever looks at today and forward: what was done today, or the next day
// that is planned this week. With neither to say, there is no line.
export type TodayLine = { strong: string; rest: string };

export function todayLine(
  logs: TrainingLog[],
  planDays: number[],
  target: number,
  today: string
): TodayLine | null {
  const share = fmtDuration(perDayMinutes(target, planDays.length));
  const at = dayIndexOf(today);
  const trained = logs.some((l) => l.trained_on === today && l.kind === "training");
  const next = planDays.find((d) => d > at);
  const nextUp = next === undefined ? "" : `Next up: ${DAY_NAMES[next]}, about ${share}.`;
  if (trained) return { strong: "Trained today.", rest: nextUp };
  if (planDays.includes(at)) return { strong: "Today is a training day.", rest: `About ${share}.` };
  return nextUp ? { strong: "", rest: nextUp } : null;
}

// "Thursday, Nov 19"
export function longDayLabel(day: string): string {
  return `${DAY_NAMES[dayIndexOf(day)]}, ${shortDate(day)}`;
}

// ---- Friends ----------------------------------------------------------

// Two accounts are friends as one stored pair, the smaller id first, so
// the same two people can never be stored twice. Nobody is their own
// friend.
export function friendPair(x: string, y: string): { a: string; b: string } | null {
  if (!x || !y || x === y) return null;
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

// What a friend sees of a name: the first name and the last initial.
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A teammate";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1].replace(/\.$/, "");
  return `${parts[0]} ${last[0].toUpperCase()}.`;
}

// The week with your friends: you and the friends you connected with by
// link, ordered by TRAINING time this week (gym never counts). It starts
// again every Monday with the week. People on the same time share a
// place. Only the top ten are listed, and you are always on it.
export type BoardEntry = { id: string; name: string; minutes: number };
export type BoardRow = BoardEntry & { place: number; time: string; me: boolean };
export const BOARD_CAP = 10;
export const BOARD_TITLE = "This week with your friends";
export const BOARD_EMPTY_LINE = "Send your link to a teammate and see who trains more this week.";

export function friendsBoard(entries: BoardEntry[], meId: string): BoardRow[] {
  const sorted = [...entries].sort(
    (x, y) => y.minutes - x.minutes || x.name.localeCompare(y.name) || x.id.localeCompare(y.id)
  );
  let place = 0;
  let last = Number.NaN;
  const rows = sorted.map((e, i) => {
    if (e.minutes !== last) {
      place = i + 1;
      last = e.minutes;
    }
    return { ...e, place, time: fmtDuration(e.minutes), me: e.id === meId };
  });
  const top = rows.slice(0, BOARD_CAP);
  const mine = rows.find((r) => r.me);
  return mine && !top.includes(mine) ? [...top, mine] : top;
}

export function addFriendQuestion(name: string): string {
  return `Add ${name} as a friend?`;
}

// "GG" for "Gary G.", "M" for "Marcus". The only picture of a person in
// the free app: there are no profile photos.
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

// ---- Blocking ---------------------------------------------------------

// A block is one-sided to make and two-sided in effect: once either of
// two players has blocked the other, they are not friends, they see
// nothing of each other, and the link can never make them friends again
// until the one who blocked takes it back.
export type Block = { blocker: string; blocked: string };

export function blockedEitherWay(blocks: Block[], x: string, y: string): boolean {
  return blocks.some(
    (b) => (b.blocker === x && b.blocked === y) || (b.blocker === y && b.blocked === x)
  );
}

// May these two become friends? Two different accounts, and no block
// between them in either direction.
export function canBefriend(x: string, y: string, blocks: Block[]): boolean {
  return friendPair(x, y) !== null && !blockedEitherWay(blocks, x, y);
}

export const BLOCKED_LINK_MESSAGE = "You cannot add this player.";

// ---- A post: a log with a photo ---------------------------------------

// A post is an entry of the log that carries a photo. The photo lives in
// a private bucket at <profile id>/<log id>.jpg and is only ever handed
// out as a short-lived signed address, to the people mayViewPhoto allows.
export const POST_BUCKET = "tracker-posts";
export const POST_URL_SECONDS = 15 * 60;
export const POST_MAX_EDGE = 1440; // the longest side, after the phone shrinks it
export const POST_JPEG_QUALITY = 0.8;
export const POST_MAX_BYTES = 3_000_000; // what the server will take
export const CAPTION_MAX = 80;
export const FEED_DAYS = 7;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function postPath(profileId: string, logId: string): string | null {
  return UUID.test(profileId) && UUID.test(logId) ? `${profileId}/${logId}.jpg` : null;
}

// Is this stored path this account's own photo? Anything that does not
// match the convention is nobody's.
export function ownsPostPath(path: string, profileId: string): boolean {
  const [folder, file, ...more] = path.split("/");
  return (
    more.length === 0 &&
    folder === profileId &&
    UUID.test(folder) &&
    /^[0-9a-f-]{36}\.jpg$/.test(file ?? "") &&
    UUID.test((file ?? "").slice(0, 36))
  );
}

// A JPEG starts FF D8 FF. The server takes nothing else.
export function looksLikeJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

// The size a photo is shrunk to before it leaves the phone: the longest
// side at most POST_MAX_EDGE, the shape kept, never made bigger.
export function fitWithin(width: number, height: number, max = POST_MAX_EDGE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (!(long > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, max / long);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// The one-line note on a post: plain text, one line, 80 characters.
// Nothing typed is the same as no note.
export function cleanCaption(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, CAPTION_MAX) : null;
}

// The first day the feed shows: today and the six days before it.
export function feedSince(today: string): string {
  return shiftDay(today, -(FEED_DAYS - 1));
}

// One stored entry, as the feed rules read it.
export type PostRow = {
  id: string;
  profile_id: string;
  trained_on: string; // the New York day it was logged
  minutes: number;
  kind: Kind;
  created_at: string;
  photo_path: string | null;
  caption: string | null;
  removed_at: string | null; // a coach took the post down
};

const hasPhoto = (p: PostRow) => Boolean(p.photo_path) && !p.removed_at;

// THE RULE OF THE FEED. A friend's post from today stays locked until
// you have posted a photo of your own training today. Your own posts are
// always open, and so is every post from an earlier day.
//
// Has this player posted a photo today? A log without a photo does not
// count, and neither does a post a coach took down.
export function postedPhotoToday(rows: PostRow[], viewerId: string, today: string): boolean {
  return rows.some((r) => r.profile_id === viewerId && r.trained_on === today && hasPhoto(r));
}

export function postLocked(input: {
  post: Pick<PostRow, "profile_id" | "trained_on">;
  viewerId: string;
  today: string;
  unlocked: boolean; // postedPhotoToday for the viewer
}): boolean {
  if (input.post.profile_id === input.viewerId) return false;
  if (input.post.trained_on !== input.today) return false;
  return !input.unlocked;
}

// WHO MAY BE HANDED A PHOTO. A post a coach took down is gone for
// everyone. A coach sees every other photo. The player who posted it
// sees their own. A friend sees it only while it is in the feed (the
// last seven days), only when they have not reported it, and only when
// it is not locked. Nobody else, ever.
export type PhotoViewer = {
  id: string;
  staff: boolean; // a coach or the admin
  friendIds: ReadonlySet<string>;
  unlocked: boolean;
  reported: ReadonlySet<string>; // post ids this viewer reported
};

export function mayViewPhoto(post: PostRow, viewer: PhotoViewer, today: string): boolean {
  if (!hasPhoto(post)) return false;
  if (viewer.staff) return true;
  if (post.profile_id === viewer.id) return true;
  if (!viewer.friendIds.has(post.profile_id)) return false;
  if (viewer.reported.has(post.id)) return false;
  if (post.trained_on < feedSince(today) || post.trained_on > today) return false;
  return !postLocked({ post, viewerId: viewer.id, today, unlocked: viewer.unlocked });
}

// Props: one tap from a friend who can see the post. Never on your own.
export function mayGiveProps(post: PostRow, viewer: PhotoViewer, today: string): boolean {
  return !viewer.staff && post.profile_id !== viewer.id && mayViewPhoto(post, viewer, today);
}

// A card of the feed. A locked card carries the friend's first name, the
// time and nothing else: no photo, no note, no way to reach either.
export type OpenCard = {
  state: "open";
  id: string;
  ownerId: string;
  mine: boolean;
  name: string; // "Gary G.", or "You"
  first: string;
  initials: string;
  kind: Kind;
  minutes: number;
  caption: string | null;
  day: string;
  createdAt: string;
  photoPath: string;
};
export type LockedCard = {
  state: "locked";
  id: string;
  first: string;
  initials: string;
  kind: Kind;
  minutes: number;
};
export type FeedCard = OpenCard | LockedCard;

// The feed: the last seven days, newest first, your friends' posts and
// your own. Only entries with a photo are cards.
export function buildFeed(input: {
  rows: PostRow[];
  viewer: PhotoViewer;
  names: ReadonlyMap<string, string>; // profile id -> "Gary G."
  today: string;
}): FeedCard[] {
  const { rows, viewer, names, today } = input;
  const since = feedSince(today);
  return rows
    .filter((r) => hasPhoto(r) && r.trained_on >= since && r.trained_on <= today)
    .filter((r) => r.profile_id === viewer.id || viewer.friendIds.has(r.profile_id))
    .filter((r) => !viewer.reported.has(r.id))
    .sort((x, y) => y.created_at.localeCompare(x.created_at) || y.id.localeCompare(x.id))
    .map((r): FeedCard => {
      const mine = r.profile_id === viewer.id;
      const name = names.get(r.profile_id) ?? "A teammate";
      const first = firstNameOf(name);
      if (!mayViewPhoto(r, viewer, today)) {
        return { state: "locked", id: r.id, first, initials: initialsOf(name), kind: r.kind, minutes: r.minutes };
      }
      return {
        state: "open",
        id: r.id,
        ownerId: r.profile_id,
        mine,
        name: mine ? "You" : name,
        first: mine ? "You" : first,
        initials: initialsOf(name),
        kind: r.kind,
        minutes: r.minutes,
        caption: r.caption,
        day: r.trained_on,
        createdAt: r.created_at,
        photoPath: r.photo_path as string,
      };
    });
}

// The row of faces: you, then the friends who trained today, then the
// rest. Lit when that person logged anything today, with or without a
// photo.
export type Face = { id: string; first: string; initials: string; you: boolean; active: boolean };

export function facesRow(input: {
  me: { id: string; name: string };
  friends: { id: string; name: string }[];
  activeToday: ReadonlySet<string>;
}): Face[] {
  const friends = input.friends
    .map((f) => ({
      id: f.id,
      first: firstNameOf(f.name),
      initials: initialsOf(f.name),
      you: false,
      active: input.activeToday.has(f.id),
    }))
    .sort((x, y) => Number(y.active) - Number(x.active) || x.first.localeCompare(y.first) || x.id.localeCompare(y.id));
  return [
    {
      id: input.me.id,
      first: "You",
      initials: initialsOf(input.me.name),
      you: true,
      active: input.activeToday.has(input.me.id),
    },
    ...friends,
  ];
}

// The big line on a locked card, and the line under it.
export function lockedHeadline(first: string, minutes: number, kind: Kind): string {
  const time = fmtDuration(minutes);
  return kind === "gym" ? `${first} was in the gym ${time} today` : `${first} trained ${time} today`;
}

export function lockedLine(friendsToday: number): string {
  const who =
    friendsToday === 1 ? "1 of your friends has trained today." : `${friendsToday} of your friends have trained today.`;
  return `${who} Post yours to see theirs.`;
}

// "42 min ago", "2h ago", "Yesterday", "Mon, Nov 16". Today's posts count
// in minutes and hours; an earlier day is named.
export function timeSince(post: { day: string; createdAt: string }, nowMs: number, today: string): string {
  if (post.day === today) {
    const mins = Math.max(0, Math.floor((nowMs - new Date(post.createdAt).getTime()) / 60_000));
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }
  return post.day === shiftDay(today, -1) ? "Yesterday" : dayLabel(post.day);
}

// What the posting screen says before anything is sent, and the plain
// link under the button.
export const POST_RULES_LINE = "Photos of your training only. Your friends see them. Coaches can remove a post.";
export const NO_PHOTO_LINK = "Log it without a photo";
export const POST_REFUSED_PHOTO = "We could not read that photo. Take another one.";

// ---- Reporting a post -------------------------------------------------

export const REPORT_REASONS = [
  { id: "not_training", label: "It is not training" },
  { id: "inappropriate", label: "It is inappropriate" },
  { id: "bullying", label: "It is bullying" },
  { id: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

export function cleanReason(raw: unknown): ReportReason | null {
  return idIn(REPORT_REASONS, raw) ? raw : null;
}

// What a coach did with a reported post.
export const REPORT_ACTIONS = ["removed", "none"] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

// The one text the coaches get for a reported post. Plain, no sign-off.
export function reportText(poster: string, url: string): string {
  return `A photo ${poster} posted in the free app was reported. Look at it here: ${url}`;
}

// ---- Age --------------------------------------------------------------

// The free app is for players 13 and older. Asked as a birth month and
// year before anything else is typed. With only a month to go on, the
// birthday counts once its month is over, so nobody is let in early.
export const FREE_MIN_AGE = 13;
export const JOIN_AGE_COOKIE = "strive_join_young";
export const UNDER_AGE_TITLE = "13 and older";
export const UNDER_AGE_LINE =
  "The free app is for players 13 and older. A parent can reach us about coaching for a younger player.";
export const BIRTH_REQUIRED_MESSAGE = "Tell us the month and year you were born.";
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export type Birth = { month: number; year: number };

export function cleanBirth(input: { month?: unknown; year?: unknown }, today: string): Birth | null {
  const month = typeof input.month === "number" ? input.month : Number(input.month);
  const year = typeof input.year === "number" ? input.year : Number(input.year);
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < thisYear - 100 || year > thisYear) return null;
  if (year === thisYear && month > thisMonth) return null;
  return { month, year };
}

// Whole years, counted as if the birthday were the last day of its month.
export function ageFromBirth(birth: Birth, today: string): number {
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  return thisYear - birth.year - (thisMonth > birth.month ? 0 : 1);
}

export function oldEnough(birth: Birth, today: string): boolean {
  return ageFromBirth(birth, today) >= FREE_MIN_AGE;
}

// The years offered on the join form, newest first.
export function birthYears(today: string): number[] {
  const thisYear = Number(today.slice(0, 4));
  const years: number[] = [];
  for (let i = 0; i < 80; i++) years.push(thisYear - 5 - i);
  return years;
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
export const FREE_HOME = "/log"; // the Friends tab: today, and the feed
export const FREE_WEEK = "/log/week"; // the My week tab
export const FREE_QUIZ = "/log/quiz";
export const FREE_DAYS = "/log/days";

// A signed-in free account that opens a teammate's link is sent to its
// week with the code along, where one sheet asks before anything is added.
export function friendAskPath(code: string): string {
  return `${FREE_HOME}?friend=${code}`;
}

// Where a free account opens: the week, or the set-up (four questions, a
// target, the days) when it has not been finished yet. Sign-in, the front door and a brand-new
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

// What a free account agrees to, in plain lines above the two boxes (the
// boxes themselves are the same as every account's: lib/elite/legal.ts).
// Written to the player, about what a free account actually stores.
export const FREE_AGREEMENT_POINTS: string[] = [
  "The free app is for players 13 and older.",
  "We store your profile, the month and year you were born, your quiz answers, the days you plan to train, the training you log and the photos you post.",
  "The friends you added see your first name, last initial, your training time and the photos you post. So do our coaches.",
  "You can report a post or block a player. We can remove a post.",
  "Some of that information is handled by the service providers named in the Privacy Policy.",
  "A coach may text or call the number you give us. Message and data rates may apply. Reply STOP to any text to end them.",
];
