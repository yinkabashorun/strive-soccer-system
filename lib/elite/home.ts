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
