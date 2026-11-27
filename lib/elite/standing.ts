// WHERE A PLAYER STANDS AMONG THEIR FRIENDS THIS WEEK: the few rules the
// phone's line ("You're 1 session away from beating Nico.",
// mobile/src/social-view.ts) and the server's notification ("Nico just
// passed you", lib/elite/free-notices-server.ts noticeFriendPassed) share,
// so the two can never count differently. Pure, and shared with the phone
// ("@shared/standing"): nothing from the server, the database or Next.
//
// Coach Yinka, Nov 27 2026: "just say what they care about. you're 1
// session away from beating (name)", and his yes the same day to the
// notification that goes with it.

// A SESSION IS THE PLAYER'S OWN: the length of one training day in the
// plan they set ("4 days. About 1h a day." is a 1 hour session), or one
// hour for a player with no days picked yet.
export const SESSION_FALLBACK_MINUTES = 60;

// One of the player's own sessions, in minutes: a planned day's length
// (lib/elite/tracker.ts perDayMinutes), or the fallback.
export function sessionMinutes(perDay: number | null | undefined): number {
  return perDay && perDay > 0 ? perDay : SESSION_FALLBACK_MINUTES;
}

// How many of those sessions put a player in FRONT of a friend who is
// `gap` minutes ahead: level is not beating, so the gap has to be passed.
export function sessionsToBeat(gap: number, session: number): number {
  return Math.max(1, Math.ceil((Math.max(0, gap) + 1) / Math.max(1, session)));
}

// WHO A PLAYER JUST PASSED. `before` and `after` are the player's own
// minutes on the friends board this week without and with the training
// they just did; each friend's minutes are the board's too (training that
// counts on boards, never gym, never a typed length:
// lib/elite/tracker.ts onBoards).
//
// A friend was passed when they were in front before (strictly more, and
// with time of their own) and are behind now (strictly fewer). A tie is
// not a pass, a friend with nothing on the board is never told anything,
// and nothing is passed unless the player's own time went up.
export type StandingRow = { id: string; minutes: number };

export function passedBy(input: { before: number; after: number; friends: readonly StandingRow[] }): StandingRow[] {
  if (!(input.after > input.before)) return [];
  return input.friends.filter((f) => f.minutes > 0 && f.minutes > input.before && f.minutes < input.after);
}
