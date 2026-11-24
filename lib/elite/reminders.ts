// A reminder at the member's own time (Nov 22 2026; made specific and
// self-limiting Nov 24 2026), as pure rules.
//
// One push, at most once a day, Monday to Saturday. Only to a member who
// turned notifications on and left "Your week" on, never on a break, never
// once the week's sessions are all done, never if they already trained
// today. The hourly plan-builder cron calls the sender
// (reminders-server.ts) and each send is claimed first in
// elite_training_reminders (078), keyed player + NY date, so a second cron
// instance or a retry sends nothing. The words live in notices.ts.
//
// WHEN. The hour is the player's own choice first (asked once, on the
// first finish screen, after they said yes to notifications; changed in
// Account): elite_players.reminder_hour (087). Else the hour they usually
// train, learned from their last ten finished drills once there are three.
// Else, for a member with nothing to learn from yet, a plain default:
// after school on weekdays, mid-morning on Saturday, starting the day
// AFTER the week went live (the week going live already told them that
// day).
//
// WHAT. The next plan session with work left, in the session card's own
// figures (reminderFacts). Never a count of anything missed.
//
// IT STOPS ITSELF. Five reminders in a row with no drill ticked off since
// the first of them, and the sixth is one last notice, "Reminders are
// paused". Then nothing, until the player ticks off a drill, when the
// reminders come back on their own.
import { drillMinutes, isDone, type SessionGroup } from "./session-flow";
import type { ReminderFacts } from "./notices";

const NY = "America/New_York";

// The default hours for a member with no chosen time and nothing to learn
// from yet (New York time).
export const NO_HISTORY_HOUR_WEEKDAY = 16;
export const NO_HISTORY_HOUR_SATURDAY = 10;

// The hours a player may choose (087 checks the same range).
export const REMINDER_HOUR_MIN = 5;
export const REMINDER_HOUR_MAX = 21;

// "When do you usually train?": one tap. "It changes" stores nothing, and
// the hour they turn out to train at is learned instead.
export const REMINDER_QUESTION = "When do you usually train?";
export const REMINDER_CHOICES = [
  { key: "before_school", label: "Before school", hour: 7 },
  { key: "after_school", label: "After school", hour: 16 },
  { key: "evening", label: "Evening", hour: 19 },
  { key: "changes", label: "It changes", hour: null },
] as const;
export type ReminderChoiceKey = (typeof REMINDER_CHOICES)[number]["key"];

export function reminderChoice(key: unknown): (typeof REMINDER_CHOICES)[number] | null {
  return REMINDER_CHOICES.find((c) => c.key === key) ?? null;
}

// The choice a stored hour shows as. No hour is "It changes"; an hour that
// is none of the three (set some other way) shows as none of them.
export function choiceForHour(hour: number | null | undefined): ReminderChoiceKey | null {
  if (hour === null || hour === undefined) return "changes";
  return REMINDER_CHOICES.find((c) => c.hour === hour)?.key ?? null;
}

export function cleanReminderHour(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= REMINDER_HOUR_MIN && raw <= REMINDER_HOUR_MAX ? raw : null;
}

// Their own choice, else the hour they are learned to train at, else the
// default for the day. `fromDefault` says nothing of theirs decided it.
export function reminderHourFor(i: {
  chosen: number | null | undefined;
  learned: number | null;
  nyDay: number; // 1 = Monday ... 7 = Sunday
}): { hour: number; fromDefault: boolean } {
  const chosen = cleanReminderHour(i.chosen);
  if (chosen !== null) return { hour: chosen, fromDefault: false };
  if (i.learned !== null) return { hour: i.learned, fromDefault: false };
  return { hour: i.nyDay === 6 ? NO_HISTORY_HOUR_SATURDAY : NO_HISTORY_HOUR_WEEKDAY, fromDefault: true };
}

// How many of the latest completed drills decide the usual hour, and how
// few are too few to guess from.
export const USUAL_HOUR_SAMPLE = 10;
export const USUAL_HOUR_MIN_POINTS = 3;

// The hour (0 to 23) in New York of an instant.
export function nyHourOf(iso: string): number | null {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return Number(t.toLocaleString("en-US", { timeZone: NY, hour: "numeric", hour12: false })) % 24;
}

// The NY calendar date (YYYY-MM-DD) of an instant.
export function nyDateOf(iso: string): string | null {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString("en-CA", { timeZone: NY });
}

// The median NY hour of the latest ten drills the member ticked off, or
// null with fewer than three to go on. An even count takes the earlier of
// the two middle hours, so a reminder never lands after they would have
// started.
export function usualHour(completedAts: (string | null | undefined)[]): number | null {
  const latest = completedAts
    .filter((s): s is string => typeof s === "string" && !Number.isNaN(new Date(s).getTime()))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, USUAL_HOUR_SAMPLE);
  if (latest.length < USUAL_HOUR_MIN_POINTS) return null;
  const hours = latest.map((s) => nyHourOf(s)!).sort((a, b) => a - b);
  return hours[Math.floor((hours.length - 1) / 2)];
}

export type ReminderInput = {
  nyHour: number; // the hour the cron is running, in NY
  nyDay: number; // 1 = Monday ... 7 = Sunday
  // their hour today (reminderHourFor), and whether it is only the default
  hour: number;
  fromDefault: boolean;
  // the week being trained went live today (New York date)
  wentLiveToday: boolean;
  notificationsOn: boolean; // a browser or the iPhone app has a device on file
  topicOff: boolean; // they turned "Your week" off (elite_profiles.notify_off)
  onBreak: boolean;
  hasWeek: boolean; // the week being trained has sessions
  sessionsLeft: number; // plan sessions of that week still open
  trainedToday: boolean; // any drill ticked off today, NY date
};

export type ReminderDecision = { send: true } | { send: false; why: string };

export function reminderDecision(i: ReminderInput): ReminderDecision {
  if (i.nyDay === 7) return { send: false, why: "sunday" };
  if (!i.notificationsOn) return { send: false, why: "notifications off" };
  if (i.topicOff) return { send: false, why: "turned off" };
  if (i.onBreak) return { send: false, why: "on a break" };
  if (!i.hasWeek) return { send: false, why: "no week yet" };
  if (i.sessionsLeft <= 0) return { send: false, why: "week complete" };
  if (i.trainedToday) return { send: false, why: "trained today" };
  if (i.fromDefault && i.wentLiveToday) return { send: false, why: "the week went live today" };
  if (i.hour !== i.nyHour) return { send: false, why: "not their hour" };
  return { send: true };
}

// What the reminder says: the first plan session with work left, as its
// card shows it (its name's number, its drills, the minutes the plan gives
// them), how many of its drills are still to do, and whether it is the
// last plan session of the week with work left. Null when nothing is left.
export function reminderFacts(sessions: SessionGroup[]): ReminderFacts | null {
  const open = sessions.filter((s) => !s.extra && s.list.some((h) => !isDone(h, {})));
  const next = open[0];
  if (!next) return null;
  return {
    session: next.n,
    drills: next.list.length,
    drillsLeft: next.list.filter((h) => !isDone(h, {})).length,
    minutes: next.list.reduce((a, h) => a + drillMinutes(h), 0),
    lastOpen: open.length === 1,
  };
}

// How many reminders in a row go unanswered before the last notice.
export const REMINDERS_BEFORE_PAUSE = 5;

// The reminders sent since the player last ticked off a drill: the claimed
// days after the day of their last tick (a reminder is never sent on a day
// they trained), or every claimed day when they have never ticked one.
export function remindersSinceTick(claimedDays: string[], lastTickDay: string | null): number {
  return claimedDays.filter((d) => !lastTickDay || d > lastTickDay).length;
}

// What today's send is. `pausedAt` is elite_players.reminders_paused_at
// (087), the lasting memory of the pause: the ledger of claimed days is
// cleaned after 60 days, the pause must outlive it. Before 087 the count
// alone decides.
export type ReminderStage = "remind" | "pause_notice" | "silent";

export function reminderStage(i: {
  sinceTick: number;
  pausedAt: string | null | undefined;
  lastTickAt: string | null | undefined;
}): ReminderStage {
  const paused = Boolean(i.pausedAt) && (!i.lastTickAt || new Date(i.lastTickAt).getTime() <= new Date(i.pausedAt as string).getTime());
  if (paused || i.sinceTick > REMINDERS_BEFORE_PAUSE) return "silent";
  if (i.sinceTick === REMINDERS_BEFORE_PAUSE) return "pause_notice";
  return "remind";
}
