// SHARE MY WEEK, the card the iPhone app hands to the share sheet (Nov 25
// 2026): what is on the story-size picture of a free player's own week.
// Pure, so the same facts can be tested without drawing anything
// (lib/elite/week-card-image.ts draws them; app/api/app/free/week/card
// serves the picture).
//
// The house rules the card is held to (tests/week-card.test.ts):
//   - only the player's own name (first name and last initial) and their
//     own numbers; no friend, no place on any board
//   - training against the target they set; gym is said on its own line
//     and never fills the ring
//   - a day with training is gold; every other day is the same quiet
//     mark, planned or not, so the card never says a day was missed
//   - no streak, no count of anything not done, no price
import { fmtDuration } from "./time-trained";
import { gymThisWeekLine, shortName, weekLabel, weekProgress, weekStrip, type TrainingLog } from "./tracker";

export const WEEK_CARD_WIDTH = 1080;
export const WEEK_CARD_HEIGHT = 1920;
export const WEEK_CARD_BRAND = "STRIVE ELITE";
export const WEEK_CARD_TITLE = "TRAINED THIS WEEK";

// There is a week to share once the player has trained in it. Before
// that the row is not shown and no card is made: a card of an empty week
// would only say what was not done.
export function hasWeekToShare(trainingMinutes: number): boolean {
  return trainingMinutes > 0;
}

export type WeekCardDay = { letter: string; trained: boolean };

export type WeekCard = {
  // "Marcus B.": what a friend sees of a name, never the full last name
  name: string;
  // "Nov 23 to Nov 29"
  week: string;
  // "2h 40m": training this week, never capped
  time: string;
  // "of 4h", or null for a player with no target set
  of: string | null;
  // how much of the ring is gold: training against the target, 0 to 1
  share: number;
  // Monday to Sunday
  days: WeekCardDay[];
  // "Gym this week: 30m" for a player who logs gym and logged some; else null
  gym: string | null;
};

export function weekCard(input: {
  fullName: string;
  logs: TrainingLog[];
  target: number; // the player's weekly target, minutes
  today: string; // YYYY-MM-DD, New York
  gym: boolean; // does this player log gym work (tracksGym)
}): WeekCard {
  const target = Math.max(0, Math.round(input.target || 0));
  const week = weekProgress(input.logs, target, input.today);
  return {
    name: shortName(input.fullName),
    week: weekLabel(input.today),
    time: fmtDuration(week.minutes),
    of: target > 0 ? `of ${fmtDuration(target)}` : null,
    share: target > 0 ? Math.min(1, week.minutes / target) : 0,
    // planned days are left out on purpose: [] means no day is marked
    // as one the player meant to train
    days: weekStrip(input.logs, [], input.today).map((d) => ({ letter: d.letter, trained: d.trained })),
    gym: input.gym ? gymThisWeekLine(week.gymMinutes) : null,
  };
}

// The picture travels inside the app's JSON answer as a data URI (the
// phone's one API client speaks JSON, and its image tool reads a base64
// data URI straight into a file).
export const PNG_DATA_PREFIX = "data:image/png;base64,";
export function isPngDataUri(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PNG_DATA_PREFIX) && value.length > PNG_DATA_PREFIX.length + 64;
}
