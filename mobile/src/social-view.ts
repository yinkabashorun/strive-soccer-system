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

// WHERE YOU STAND THIS WEEK: one line from the friends board, said at the
// top of Friends and over the board on Week, so the gap to the next friend
// is the first thing a player reads ("You're 2nd of 5 this week. 18m to
// pass Diego."). Among friends only, from training that counts on the
// board. It never says what anyone has not done: a player with no time yet
// reads who leads; a friend is only ever named with time on the board.
// Null with no friends on the board, or when nobody has trained yet.
export type StandRow = { me: boolean; name: string; minutes: number };
export type Standing = { strong: string; rest: string | null };

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

const firstOf = (name: string): string => name.trim().split(/\s+/)[0] || "A friend";
const span = (m: number): string => {
  const r = Math.max(1, Math.round(m));
  if (r < 60) return `${r}m`;
  return r % 60 ? `${Math.floor(r / 60)}h ${r % 60}m` : `${Math.floor(r / 60)}h`;
};

export function standingLine(board: readonly StandRow[]): Standing | null {
  const me = board.find((r) => r.me);
  const others = board.filter((r) => !r.me);
  if (!me || others.length === 0) return null;
  const trained = others.filter((r) => r.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  if (!(me.minutes > 0)) {
    const leader = trained[0];
    return leader ? { strong: `${firstOf(leader.name)} leads your friends this week`, rest: `${span(leader.minutes)} so far.` } : null;
  }
  const above = trained.filter((r) => r.minutes > me.minutes);
  if (above.length === 0) {
    const level = trained.find((r) => r.minutes === me.minutes);
    if (level) return { strong: `You and ${firstOf(level.name)} are level at the top`, rest: "Your next session takes the lead." };
    const next = trained[0];
    return { strong: "You lead your friends this week", rest: next ? `${firstOf(next.name)} is ${span(me.minutes - next.minutes)} back.` : null };
  }
  const ahead = above[above.length - 1];
  return {
    strong: `You're ${ordinal(above.length + 1)} of ${board.length} this week`,
    rest: `${span(ahead.minutes - me.minutes)} to pass ${firstOf(ahead.name)}.`,
  };
}

export function standingSaid(s: Standing): string {
  return s.rest ? `${s.strong}. ${s.rest}` : `${s.strong}.`;
}
