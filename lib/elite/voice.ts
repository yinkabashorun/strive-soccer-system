// THE APP'S VOICE: "a mix" (Coach Yinka, the copy quiz, Nov 28 2026: "there
// should be a mix"; the guide is marketing/copy/voice-guide.md, rule 9).
// The same moment does not say the same sentence every time: each moment
// keeps a few lines and one is picked.
//
// The pick is DETERMINISTIC: the same seed always gives the same line, so a
// line never flickers between two draws of a screen, and a notification
// sent again says the same words. A seed is who the line is for and the
// day ("<profile id>:2026-11-28"), plus the moment's own name where two
// moments could share a seed.
//
// Pure: no imports. Shared with the phone ("@shared/voice").

// A small string hash (FNV-1a, 32 bit): stable everywhere, no dependency.
export function seedHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// One of `lines`, chosen by the seed. With one line it is that line; with
// none it throws, because a moment with nothing to say is a bug to find in
// a test, never an empty sentence on a player's screen.
export function pickLine<T>(lines: readonly T[], seed: string): T {
  if (lines.length === 0) throw new Error("pickLine: no lines to pick from");
  return lines[seedHash(seed) % lines.length];
}

// The New York day (YYYY-MM-DD) for a seed made on the phone: the phone's
// own clock, said in New York's day like the server's seeds.
export function seedDay(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts;
}
