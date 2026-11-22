// A reminder at the member's usual time (Nov 22 2026), as pure rules.
//
// One push, at most once a day, Monday to Saturday, at the hour the member
// usually trains. Only to a member who turned notifications on, never on a
// break, never once the week's sessions are all done, never if they
// already trained today. The hourly plan-builder cron calls the sender
// (reminders-server.ts) and each send is claimed first in
// elite_training_reminders (078), keyed player + NY date, so a second cron
// instance or a retry sends nothing. The words live in push-texts.ts.

const NY = "America/New_York";

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
  usualHour: number | null;
  notificationsOn: boolean; // a browser or the iPhone app has a device on file
  onBreak: boolean;
  hasWeek: boolean; // the week being trained has sessions
  sessionsLeft: number; // plan sessions of that week still open
  trainedToday: boolean; // any drill ticked off today, NY date
};

export type ReminderDecision = { send: true } | { send: false; why: string };

export function reminderDecision(i: ReminderInput): ReminderDecision {
  if (i.nyDay === 7) return { send: false, why: "sunday" };
  if (!i.notificationsOn) return { send: false, why: "notifications off" };
  if (i.onBreak) return { send: false, why: "on a break" };
  if (!i.hasWeek) return { send: false, why: "no week yet" };
  if (i.sessionsLeft <= 0) return { send: false, why: "week complete" };
  if (i.trainedToday) return { send: false, why: "trained today" };
  if (i.usualHour === null) return { send: false, why: "no usual time yet" };
  if (i.usualHour !== i.nyHour) return { send: false, why: "not their hour" };
  return { send: true };
}
