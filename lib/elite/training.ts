// Strive Elite training model.
//
// Every week is a fixed number of sessions set by the player's training
// load (033): In-Season is FOUR, Off-Season is SIX. Every session STARTS
// with a plyometric warm-up the player can do in their room. The warm-ups
// come ONLY from the coach's filmed drill bank (pillar "Plyo"). There is
// no built-in list: until Oct 2 2026 this file carried four unfilmed
// warm-up circuits that reached real players whenever the bank wasn't
// passed through.

import type { TrainingLoad } from "./types";

// The default (and the only load before 033): the busy-schedule plan.
export const SESSIONS_PER_WEEK = 4;
export const MINUTES_PER_SESSION = 40;

export const TRAINING_LOADS: Record<
  TrainingLoad,
  { sessions: number; label: string; blurb: string }
> = {
  in_season: {
    sessions: 4,
    label: "In-Season",
    blurb: "4 sessions a week, about 40 minutes. For a player already training 3 to 4 times a week with a team.",
  },
  off_season: {
    sessions: 6,
    label: "Off-Season",
    blurb: "6 sessions a week, about 40 minutes. For the player with more in the tank or no team load right now.",
  },
};

// Sessions in a week for a player. Unknown / missing / demo = In-Season,
// so every pre-033 row keeps exactly the week it has today.
export function sessionsFor(load?: TrainingLoad | null): number {
  return (load && TRAINING_LOADS[load]?.sessions) || SESSIONS_PER_WEEK;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
// "four" / "six" for copy that says the count out loud.
export function sessionsWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export type Drill = {
  title: string;
  exercise: string;
  reps: string;
  minutes?: number;
  notes?: string;
};
