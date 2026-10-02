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
