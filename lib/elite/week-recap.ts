// THE MONDAY MOMENT (the free app's Week tab, website and iPhone app): a
// small card about LAST week, at the top of Week, once a week. It is said
// in the app only: nothing here sends a notification.
//
// Pure: the server reads the numbers (tracker-server.ts weekRecapInputFor)
// and this file decides what is said. The rules:
//   - The number is the player's own training that counts on a board
//     (timed training, training-clock.ts countsOnBoards): the same sum the
//     friends board uses. Gym never counts toward it, typed time never
//     counts toward it.
//   - A player whose last week has nothing that counts gets NO card. A week
//     with nothing in it is never mentioned.
//   - Their place among friends is said only when at least two accepted
//     friends trained last week too, and only in the top half (ties share
//     a place). Below the top half the line is left out, never softened.
//   - "Your best week yet." only when it is true: more counting minutes
//     than every earlier week, with at least three earlier weeks of
//     training to beat.
//   - Gym on its own short line, only when there was any.
import { fmtDuration } from "./time-trained";

export type WeekRecapInput = {
  // The Monday (YYYY-MM-DD, New York) of the week this card is shown in:
  // the key the phone remembers "Got it" by.
  week: string;
  // The player's own counting minutes last week.
  lastWeek: number;
  // Their counting minutes in each week before last week (any order;
  // weeks with nothing in them may be left out or sent as 0).
  earlier: number[];
  // Gym last week (0 when the player does not track gym).
  gymLastWeek: number;
  // Each accepted friend's counting minutes last week.
  friends: number[];
};

export type WeekRecap = {
  week: string;
  trained: string; // "Last week you trained 3h 10m."
  gym: string | null; // "Gym: 1h 30m."
  place: string | null; // "2nd of 7 friends who trained."
  best: string | null; // "Your best week yet."
  dismiss: string; // "Got it"
};

export const RECAP_DISMISS = "Got it";
export const RECAP_BEST = "Your best week yet.";
export const RECAP_MIN_FRIENDS = 2; // friends who trained, for a place
export const RECAP_MIN_EARLIER = 3; // earlier weeks with training, for a best

export function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  const last = n % 10;
  return `${n}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}

// The player's place among themselves and the friends who trained last
// week: 1 + how many trained more (so ties share a place). Null when
// fewer than two friends trained, or when the place is below the top half
// (the top half is the first ceil(n / 2) places).
export function recapPlace(mine: number, friends: number[]): { place: number; of: number } | null {
  if (mine <= 0) return null;
  const trained = friends.filter((m) => m > 0);
  if (trained.length < RECAP_MIN_FRIENDS) return null;
  const of = trained.length + 1;
  const place = 1 + trained.filter((m) => m > mine).length;
  return place <= Math.ceil(of / 2) ? { place, of } : null;
}

export function recapIsBest(mine: number, earlier: number[]): boolean {
  if (mine <= 0) return false;
  const weeks = earlier.filter((m) => m > 0);
  if (weeks.length < RECAP_MIN_EARLIER) return false;
  return weeks.every((m) => mine > m);
}

export function weekRecap(input: WeekRecapInput): WeekRecap | null {
  const mine = Math.max(0, Math.round(input.lastWeek));
  if (mine <= 0) return null;
  const place = recapPlace(mine, input.friends);
  return {
    week: input.week,
    trained: `Last week you trained ${fmtDuration(mine)}.`,
    gym: input.gymLastWeek > 0 ? `Gym: ${fmtDuration(input.gymLastWeek)}.` : null,
    place: place ? `${ordinal(place.place)} of ${place.of} friends who trained.` : null,
    best: recapIsBest(mine, input.earlier) ? RECAP_BEST : null,
    dismiss: RECAP_DISMISS,
  };
}

// Is this card still to be shown on this device? Once "Got it" is tapped
// for a week it never comes back that week; next week's card has its own
// key, so it shows once.
export function recapDue(recap: WeekRecap | null | undefined, seenWeek: string | null | undefined): boolean {
  return Boolean(recap) && recap!.week !== seenWeek;
}
