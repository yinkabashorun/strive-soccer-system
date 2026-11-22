// Home, as pure rules (App Store punch list, A1).
//
// Home answers one question, "what do I do today", and nothing competes
// with the Start button. So under the session card there is one quiet row
// and nothing else that is always there: Extra work, the coach's latest
// note and "Take a break" are one tap each and stay folded until asked
// for. Time trained shows once (the pill beside the greeting, which opens
// Progress) and the week shows once (on the session card). Achievements
// live on the Progress page.

export type HomeMoreKey = "extra" | "coach" | "break";

export type HomeMoreItem = { key: HomeMoreKey; label: string };

// Which folded items the quiet row offers, in order. Never more than
// three, so each is a full-width thumb target on a phone.
export function homeMoreItems(input: {
  // The week being trained exists (Extra work adds a session to it).
  hasWeek: boolean;
  // The coach has written to this player.
  hasCoachNote: boolean;
  // A real member who is not on a break can set one from here.
  canSetBreak: boolean;
}): HomeMoreItem[] {
  const items: HomeMoreItem[] = [];
  if (input.hasWeek) items.push({ key: "extra", label: "Extra work" });
  if (input.hasCoachNote) items.push({ key: "coach", label: "Coach's note" });
  if (input.canSetBreak) items.push({ key: "break", label: "Take a break" });
  return items;
}

// THE GOAL LADDER (Nov 22 2026): at the top of the session card, why
// today's session matters, top to bottom: the player's goal, this block's
// focus, how far through this week they are. Then the Start button.
//   goal   the 3-month program's quiz answer when a program exists, else
//          the first goal from onboarding; no rung when there is none
//   focus  the program's focus pillar for the week being trained; no rung
//          without a program (or past its twelve weeks)
//   week   "2 of 4": plan sessions done of the plan sessions in the week
//          (Extra work is on top of the week and never counted)
// Never a streak, never a count of anything missed.
export type LadderRung = { key: "goal" | "focus" | "week"; label: string; value: string };

export function goalLadder(input: {
  programGoal?: string | null;
  onboardingGoal?: string | null;
  focusName?: string | null;
  sessionsDone: number;
  sessionsTotal: number;
}): LadderRung[] {
  const rungs: LadderRung[] = [];
  const goal = (input.programGoal ?? "").trim() || (input.onboardingGoal ?? "").trim();
  if (goal) rungs.push({ key: "goal", label: "Goal", value: goal });
  const focus = (input.focusName ?? "").trim();
  if (focus) rungs.push({ key: "focus", label: "This block", value: focus });
  if (input.sessionsTotal > 0) {
    const done = Math.max(0, Math.min(input.sessionsDone, input.sessionsTotal));
    rungs.push({ key: "week", label: "This week", value: `${done} of ${input.sessionsTotal}` });
  }
  return rungs;
}
