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

// ---------------------------------------------------------------------
// THE WEEK'S CARD (the voice guide, moment 8, Nov 28 2026): the same card,
// moved and rewritten. It first appears SUNDAY from 12:00 PM New York,
// about the week still running (Monday to that moment), and stays through
// MONDAY (New York) as the closed week, for a player who did not open the
// app on Sunday. One "Got it" covers both days: both are keyed to the week
// the card is about (its Monday). From Tuesday there is no card until the
// next Sunday noon. No notification.
//
// Builds 10 and 11 draw `recap` (above) under its own fixed "Last week you
// trained" line, so a Sunday card is never sent there: this one travels
// in the additive field `weekCard` (app-contract.ts), which only newer
// builds read, and `recap` is sent exactly as before.
//
// The words, one number a line at most, each only when it is true:
//   Sunday  "Best week yet: 3h 10m." or "3h 10m this week."
//           "You're outworking Nico." / "... Nico and Diego." (friends
//           who trained, behind; two names at most), or, when exactly one
//           friend has done more, "Only Kai has done more. You've still got
//           today."  Close: "Finish it strong."
//   Monday  "Best week yet: 3h 10m." or "3h 10m last week."
//           "You outworked Nico." / "... Nico and Diego.", or "Only Kai did
//           more. This week that changes."  Close: "Run it back."
// "Best week yet" holds to recapIsBest (beats every earlier week, with
// three earlier weeks of training to beat). Gym keeps its own short line.
// No place line ("2nd of 5 friends") any more.
// ---------------------------------------------------------------------

export type WeekCardMoment = "sunday" | "monday";
export const WEEK_CARD_FROM_HOUR = 12; // Sunday, New York

// When a card may show, from the clock: Sunday from noon New York, all of
// Monday New York, never otherwise.
export function weekCardMoment(now: Date): WeekCardMoment | null {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const day = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  if (day === "Sun") return hour >= WEEK_CARD_FROM_HOUR ? "sunday" : null;
  if (day === "Mon") return "monday";
  return null;
}

export type WeekCardFriend = { name: string; minutes: number };
export type WeekCardInput = {
  moment: WeekCardMoment;
  // the Monday of the week the card is about (the key "Got it" is kept by)
  week: string;
  // the player's own counting minutes that week (so far, on a Sunday)
  mine: number;
  earlier: number[];
  gym: number;
  // each accepted friend's counting minutes that week, with the name
  friends: WeekCardFriend[];
};
export type WeekCard = {
  week: string;
  moment: WeekCardMoment;
  // the lines, in order: the number, gym, the friends line, the close
  headline: string;
  gym: string | null;
  friends: string | null;
  close: string;
  best: boolean;
  dismiss: string;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "";
const andNames = (names: string[]) => (names.length === 2 ? `${names[0]} and ${names[1]}` : names[0]);

export function weekCardFriendsLine(moment: WeekCardMoment, mine: number, friends: WeekCardFriend[]): string | null {
  const trained = friends.filter((f) => f.minutes > 0 && firstName(f.name));
  const ahead = trained.filter((f) => f.minutes > mine);
  if (ahead.length === 1) {
    const who = firstName(ahead[0].name);
    return moment === "sunday" ? `Only ${who} has done more. You've still got today.` : `Only ${who} did more. This week that changes.`;
  }
  if (ahead.length > 0) return null;
  const behind = [...new Set(trained.filter((f) => f.minutes < mine).sort((a, b) => b.minutes - a.minutes).map((f) => firstName(f.name)))].slice(0, 2);
  if (behind.length === 0) return null;
  return moment === "sunday" ? `You're outworking ${andNames(behind)}.` : `You outworked ${andNames(behind)}.`;
}

export function weekCard(input: WeekCardInput): WeekCard | null {
  const mine = Math.max(0, Math.round(input.mine));
  if (mine <= 0) return null;
  const t = fmtDuration(mine);
  const best = recapIsBest(mine, input.earlier);
  return {
    week: input.week,
    moment: input.moment,
    headline: best ? `Best week yet: ${t}.` : input.moment === "sunday" ? `${t} this week.` : `${t} last week.`,
    gym: input.gym > 0 ? `Gym: ${fmtDuration(input.gym)}.` : null,
    friends: weekCardFriendsLine(input.moment, mine, input.friends),
    close: input.moment === "sunday" ? "Finish it strong." : "Run it back.",
    best,
    dismiss: RECAP_DISMISS,
  };
}

export function weekCardLines(card: WeekCard): string[] {
  return [card.headline, card.gym, card.friends, card.close].filter((l): l is string => Boolean(l));
}

// Shown on this device? The same rule as recapDue: once "Got it" is
// tapped for the week the card is about, neither Sunday's nor Monday's
// comes back.
export function weekCardDue(card: WeekCard | null | undefined, seenWeek: string | null | undefined): boolean {
  return Boolean(card) && card!.week !== seenWeek;
}
