// Strive Elite training model.
//
// Every week is FOUR sessions, and every session STARTS with a plyometric
// warm-up the player can do in their room. These warm-ups are guaranteed
// server-side (prepended to each session) so the plyo-first rule holds no
// matter what the coach types or the AI returns.

export const SESSIONS_PER_WEEK = 4;

export type Drill = {
  title: string;
  exercise: string;
  reps: string;
  minutes?: number;
  notes?: string;
};

// Four room-friendly plyometric warm-ups — rotated across the week's
// sessions so it never feels repetitive.
export const PLYO_WARMUPS: Drill[] = [
  {
    title: "Plyo warm-up — Pogo & Tuck",
    exercise:
      "Pogo hops x20, tuck jumps x10, split-squat jumps x8 each leg. Land soft and quiet, explode straight back up.",
    reps: "3 rounds",
    minutes: 10,
    notes: "In your room. Bare feet or trainers. Full recovery between rounds.",
  },
  {
    title: "Plyo warm-up — Lateral Power",
    exercise:
      "Lateral bounds x10 each side, skater hops x12 each side, squat jumps x12. Stick every landing for one second.",
    reps: "3 rounds",
    minutes: 10,
    notes: "Push off the outside foot, absorb quietly.",
  },
  {
    title: "Plyo warm-up — Quick Feet",
    exercise:
      "Ankle pogos x30, broad-jump-to-stick x6, single-leg hops x8 each leg. Stay light and springy.",
    reps: "3 rounds",
    minutes: 10,
    notes: "Minimal ground contact — think 'hot floor'.",
  },
  {
    title: "Plyo warm-up — Explosive",
    exercise:
      "Tuck jumps x10, split jumps x10 each leg, step-down-to-jump off a low step x6. Maximum effort, soft landings.",
    reps: "3 rounds",
    minutes: 10,
    notes: "Use the edge of a bed or a sturdy step for the step-downs.",
  },
];

export function plyoForSession(session: number): Drill {
  return PLYO_WARMUPS[(session - 1) % PLYO_WARMUPS.length];
}
