// Weekly Film Room and monthly check-in calls (migration 062, Nov 5 2026).
// Everything here is pure: NY wall-clock time to an instant, the default
// Sunday 7pm Film Room and its Saturday 9pm clip deadline, the 30-minute
// slots of a check-in day, one-call-a-month and 24-hour-cancel rules, and
// the announcement texts. The server actions and the pages only call
// these, so the rules live once and are unit-tested.
import { shiftDay } from "./time";

const NY = "America/New_York";

export const FILM_CLIPS_MIN = 3; // asked for; the app never blocks on it
export const FILM_CLIPS_MAX = 5; // held by a database trigger too
export const FILM_ROOM_HOUR = "19:00"; // Sunday 7pm ET, Coach Yinka Nov 5
export const CLIPS_DUE_TIME = "21:00"; // the evening before, 9pm ET
export const CHECKIN_SLOT_MINUTES = 30;
export const CHECKIN_MAX_SLOTS = 24;
export const CANCEL_NOTICE_HOURS = 24;

// What the NY wall clock reads at this instant, as if it were UTC.
function nyWall(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

// A NY wall-clock time ("2026-11-08", "19:00") as a UTC ISO instant.
// DST-proof: the offset is read at the instant itself, twice.
export function nyLocalToIso(day: string, time: string): string {
  const [y, mo, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const want = Date.UTC(y, mo - 1, d, h, mi);
  let t = want;
  for (let i = 0; i < 2; i++) t = want - (nyWall(t) - t);
  return new Date(t).toISOString();
}

export function isDay(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00Z").getTime());
}

export function isTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

// The next Sunday on or after today (NY date string).
export function nextSunday(today: string): string {
  const js = new Date(today + "T00:00:00Z").getUTCDay(); // 0 = Sunday
  return shiftDay(today, (7 - js) % 7);
}

// When clips are due for a Film Room on this day: the evening before, 9pm
// ET (Saturday 9pm for the Sunday session).
export function clipsDueIso(day: string): string {
  return nyLocalToIso(shiftDay(day, -1), CLIPS_DUE_TIME);
}

export type FilmRoomDefaults = { day: string; time: string };
export function defaultFilmRoom(today: string): FilmRoomDefaults {
  return { day: nextSunday(today), time: FILM_ROOM_HOUR };
}

// The slots of a check-in day: back-to-back, each fully inside the window.
export function generateSlots(day: string, start: string, end: string, minutes: number): string[] {
  if (!isDay(day) || !isTime(start) || !isTime(end)) return [];
  if (!Number.isInteger(minutes) || minutes < 10 || minutes > 120) return [];
  const from = new Date(nyLocalToIso(day, start)).getTime();
  const to = new Date(nyLocalToIso(day, end)).getTime();
  const step = minutes * 60_000;
  const out: string[] = [];
  for (let t = from; t + step <= to && out.length < CHECKIN_MAX_SLOTS; t += step) {
    out.push(new Date(t).toISOString());
  }
  return out;
}

// "2026-11" in NY, the one-call-a-month key.
export function monthKeyNY(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: NY }).slice(0, 7);
}

// A booked call can be given back until 24 hours before it starts.
export function canCancelSlot(startsAtIso: string, nowMs = Date.now()): boolean {
  return new Date(startsAtIso).getTime() - nowMs >= CANCEL_NOTICE_HOURS * 3_600_000;
}

export type SlotLike = { starts_at: string; player_id: string | null };

// Open, in the future, and the player has no call booked in that month.
export function bookableSlots<T extends SlotLike>(slots: T[], bookedMonths: string[], nowMs = Date.now()): T[] {
  const taken = new Set(bookedMonths);
  return slots
    .filter((s) => s.player_id === null)
    .filter((s) => new Date(s.starts_at).getTime() > nowMs)
    .filter((s) => !taken.has(monthKeyNY(s.starts_at)))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function fmtWhen(iso: string): string {
  const text = new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: NY,
  });
  // Node versions differ on "at" between the date and the time.
  return text.replace(/,? (?:at )?(\d{1,2}:\d{2})/, " at $1") + " ET";
}

export function fmtDayWindow(startIso: string, endIso: string): string {
  const day = new Date(startIso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: NY,
  });
  const t = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: NY }).replace(":00", "");
  return `${day}, ${t(startIso)} to ${t(endIso)} ET`;
}

function parentFirst(parentName: string | null | undefined, playerName: string): string {
  return ((parentName || playerName || "").trim().split(" ")[0]) || "there";
}

// The Film Room announcement, in Coach Yinka's voice (stamped Sept 26):
// "Hey <Parent>," opener, no sign-off, a forward-looking close, no
// exclamation point, no em dash. The Zoom link is not in the text; it sits
// on the Film page in the app.
export function filmRoomAnnouncement(input: {
  parentName?: string | null;
  playerName: string;
  scheduledAt: string;
  clipsDueAt: string;
  appUrl: string;
}): { sms: string; pushTitle: string; pushBody: string; inAppTitle: string; inAppBody: string } {
  const parent = parentFirst(input.parentName, input.playerName);
  const first = input.playerName.trim().split(" ")[0] || "your player";
  const when = fmtWhen(input.scheduledAt);
  const due = fmtWhen(input.clipsDueAt);
  return {
    sms: `Hey ${parent}, this week's Film Room is ${when} on Zoom with Coach Yinka and Coach Gary. Please upload ${FILM_CLIPS_MIN} to ${FILM_CLIPS_MAX} clips of ${first} from games or training by ${due}. Open the app, tap Film, and add them there: ${input.appUrl}/film Let's make it a good one.`,
    pushTitle: "This week's Film Room",
    pushBody: `${when}. Upload ${FILM_CLIPS_MIN} to ${FILM_CLIPS_MAX} clips by ${due} in the Film tab.`,
    inAppTitle: "This week's Film Room",
    inAppBody: `${when} on Zoom. Upload ${FILM_CLIPS_MIN} to ${FILM_CLIPS_MAX} clips by ${due} in the Film tab.`,
  };
}

export function checkinAnnouncement(input: {
  parentName?: string | null;
  playerName: string;
  startsAt: string;
  endsAt: string;
  minutes: number;
  appUrl: string;
}): { sms: string; pushTitle: string; pushBody: string; inAppTitle: string; inAppBody: string } {
  const parent = parentFirst(input.parentName, input.playerName);
  const first = input.playerName.trim().split(" ")[0] || "your player";
  const window = fmtDayWindow(input.startsAt, input.endsAt);
  return {
    sms: `Hey ${parent}, monthly check-in calls with Coach Yinka and Coach Gary are open on ${window}. Each call is ${input.minutes} minutes. Open the app and pick a time for ${first}: ${input.appUrl}/dashboard Let's get ${first} on the calendar.`,
    pushTitle: "Monthly check-in calls are open",
    pushBody: `${window}. Pick your ${input.minutes}-minute time on your dashboard.`,
    inAppTitle: "Monthly check-in calls are open",
    inAppBody: `${window}. Pick your ${input.minutes}-minute time on your dashboard.`,
  };
}
