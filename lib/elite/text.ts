// Tiny text guarantees that templates downstream rely on. Pure and
// unit-tested (tests/text.test.ts).

// A weekly_focus is "one sentence" per the AI schema, and three SMS
// templates splice it mid-text. Guarantee it ends in punctuation so no
// template can ever produce "...earn its keep.." or a run-on again (Sept
// 30 2026 recurrence).
export function ensureSentence(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

// The week's focus line is read by the PLAYER: on the "Your week is here"
// screen, in the bell and on a locked phone. It has to read like something
// they would want to see (Coach Yinka, Nov 24 2026: "everything must have
// the copy thats instagram level and people actually want to see and is
// easy to read"), not like a coach's note. Production was showing "Back to
// the pillars: ball mastery, scanning, passing, confidence."
export const FOCUS_MAX = 72;

// "This week goes after your weak foot." / "... your weak foot and first
// touch." Two areas at most, in the player's own words for them.
export function weekFocusLine(areas: string[]): string {
  const seen: string[] = [];
  for (const a of areas) {
    const word = a.trim().toLowerCase();
    if (word && !seen.includes(word)) seen.push(word);
  }
  if (seen.length === 0) return "This week is built around your game.";
  return `This week goes after your ${seen.slice(0, 2).join(" and ")}.`;
}

// Whatever wrote the line, the player gets one short sentence: the first
// sentence only, no list after a colon, never longer than FOCUS_MAX.
export function playerFocus(s: string): string {
  let t = (s ?? "")
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/!/g, ".")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return weekFocusLine([]);
  const end = t.search(/[.!?](\s|$)/);
  if (end > -1) t = t.slice(0, end + 1);
  const colon = t.indexOf(":");
  if (colon > -1) t = t.slice(0, colon);
  if (t.length > FOCUS_MAX) {
    t = t.slice(0, FOCUS_MAX);
    t = t.slice(0, Math.max(t.lastIndexOf(" "), 1));
  }
  t = t.replace(/[\s,;:\u2014\u2013-]+$/, "");
  return t ? ensureSentence(t) : weekFocusLine([]);
}
