// The small rules behind the social half's pictures (Nov 24 2026: Friends,
// Week and Clubs polished to the training loop's standard). Pure, tested
// in tests/logic.test.ts.

// How long a bar is drawn: this time against the most on the board. A
// player with any time at all gets a bar that can be seen; nobody with
// time is drawn as nothing.
export const BAR_MIN = 0.04;
export function barShare(minutes: number, top: number): number {
  if (!(minutes > 0) || !(top > 0)) return 0;
  return Math.min(1, Math.max(BAR_MIN, minutes / top));
}

// The two halves of a matchup's bar: this club's share of the two times
// per player. Level (or nothing trained yet) is half and half; a club
// with time is never drawn as nothing.
export function matchupSplit(mine: number, theirs: number): number {
  const total = Math.max(0, mine) + Math.max(0, theirs);
  if (!(total > 0)) return 0.5;
  return Math.min(0.94, Math.max(0.06, Math.max(0, mine) / total));
}

// A club's record as the two numbers a player says out loud: "4-1".
// Read from the plain line the server sends ("Weeks won: 3. Weeks lost:
// 1. Draws: 0."), so the long line stays the one source and what a screen
// reader says. Null when the line is not in that shape.
export function recordShort(line: string | null | undefined): string | null {
  const m = /won: (\d+)\. .*lost: (\d+)\. Draws: (\d+)\./.exec(line ?? "");
  if (!m) return null;
  return Number(m[3]) > 0 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`;
}

// What "Send my link" hands the share sheet. The words carry the player's
// code to type in the app AND their link (lib/elite/free-door.ts
// friendShareText): a link alone opens the website, never the app. A
// server from before the words existed sends the link alone, as before.
export function inviteShare(p: { invite: string; inviteText?: string }): { message: string } | { url: string } {
  return p.inviteText ? { message: p.inviteText } : { url: p.invite };
}
