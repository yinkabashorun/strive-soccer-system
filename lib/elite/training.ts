// Strive Elite training model.
//
// Every week is FOUR sessions, and every session STARTS with a plyometric
// warm-up the player can do in their room. The warm-ups come ONLY from the
// coach's filmed drill bank (pillar "Plyo"). There is no built-in list:
// until Oct 2 2026 this file carried four unfilmed warm-up circuits that
// reached real players whenever the bank wasn't passed through.

export const SESSIONS_PER_WEEK = 4;

export type Drill = {
  title: string;
  exercise: string;
  reps: string;
  minutes?: number;
  notes?: string;
};
