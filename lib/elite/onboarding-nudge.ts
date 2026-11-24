// The text to a family that joined and has not finished the player's
// profile, as a pure rule (the daily cron in
// app/api/elite/cron/onboarding-reminders sends it; its words are Coach
// Yinka's own and live there, unchanged).
//
// At most THREE, on days 1, 4 and 7 after joining, and never after day 8.
// Before Nov 24 2026 it went out every three days for as long as the
// profile stayed unfinished, with no end.
//
// No new column: which of the three have gone is read from when the last
// one was sent (elite_players.onboarding_reminder_sent_at) against when
// the family joined (joined_at). A day the cron missed is not made up for
// twice: one text covers every day that has passed.

export const NUDGE_DAYS = [1, 4, 7] as const;
export const NUDGE_LAST_DAY = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

// Whole days since they joined.
export function daysSince(joinedAt: string, at: number): number | null {
  const t = new Date(joinedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((at - t) / DAY_MS);
}

// How many of the three a day number has reached.
function reached(day: number): number {
  return NUDGE_DAYS.filter((d) => d <= day).length;
}

export function onboardingNudgeDue(i: {
  joinedAt: string | null | undefined;
  lastSentAt: string | null | undefined;
  now: number;
}): boolean {
  if (!i.joinedAt) return false;
  const day = daysSince(i.joinedAt, i.now);
  if (day === null || day < NUDGE_DAYS[0] || day > NUDGE_LAST_DAY) return false;
  const sentDay = i.lastSentAt ? daysSince(i.joinedAt, new Date(i.lastSentAt).getTime()) : null;
  const sent = sentDay === null ? 0 : Math.max(1, reached(sentDay));
  return reached(day) > sent;
}
