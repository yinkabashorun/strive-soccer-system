import { SESSION_FALLBACK_MINUTES, landedLines, sessionMinutes, sessionsToBeat } from "@shared/standing";
import { pickLine } from "@shared/voice";

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
// top of Friends and over the board on Week. It says the one thing a
// player cares about (the owner, Nov 27 2026: "just say what they care
// about. you're 1 session away from beating (name)"):
//
//   "You're 1 session away from beating Nico."
//
// A SESSION IS THE PLAYER'S OWN: the length of one training day in the
// plan they set ("4 days. About 1h a day." is a 1 hour session), or one
// hour for a player with no days picked yet. So the line is a promise the
// app can keep: train one of your own sessions on the clock, and you pass
// that friend if that friend does not train in the meantime. The friend
// named is always the NEXT one up, the closest one to beat.
//
// Among friends only, from training that counts on the board. It never
// says what anyone has not done: a friend is only ever named with time on
// the board. Null with no friends on the board, or when nobody has trained.
export type StandRow = { me: boolean; name: string; minutes: number };
export type Standing = { strong: string; rest: string | null };

// What a session is and how many beat a friend: one rule for this line and
// for the server's "Nico just passed you" notification
// (lib/elite/standing.ts, imported at the top of this file).
export { SESSION_FALLBACK_MINUTES, sessionMinutes, sessionsToBeat };

const firstOf = (name: string): string => name.trim().split(/\s+/)[0] || "A friend";
const span = (m: number): string => {
  const r = Math.max(1, Math.round(m));
  if (r < 60) return `${r}m`;
  return r % 60 ? `${Math.floor(r / 60)}h ${r % 60}m` : `${Math.floor(r / 60)}h`;
};

export function standingLine(board: readonly StandRow[], perDay?: number | null): Standing | null {
  const me = board.find((r) => r.me);
  const others = board.filter((r) => !r.me);
  if (!me || others.length === 0) return null;
  const trained = others.filter((r) => r.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  if (trained.length === 0 && !(me.minutes > 0)) return null;
  const above = trained.filter((r) => r.minutes > me.minutes);
  if (above.length > 0) {
    // the closest friend to beat, and how many of the player's own sessions it takes
    const next = above[above.length - 1];
    const n = sessionsToBeat(next.minutes - me.minutes, sessionMinutes(perDay));
    return { strong: `You're ${n} ${n === 1 ? "session" : "sessions"} away from beating ${firstOf(next.name)}`, rest: null };
  }
  const level = trained.find((r) => r.minutes === me.minutes);
  if (level) return { strong: `You and ${firstOf(level.name)} are tied`, rest: "Your next session puts you in front." };
  const chaser = trained[0];
  return {
    strong: others.length === 1 ? `You're beating ${firstOf(others[0].name)} this week` : "You're beating all your friends this week",
    rest: chaser ? `${firstOf(chaser.name)} is ${span(me.minutes - chaser.minutes)} from catching you.` : null,
  };
}

export function standingSaid(s: Standing): string {
  return s.rest ? `${s.strong}. ${s.rest}` : `${s.strong}.`;
}

// THE PAYOFF: the friend a player just passed. Between two reads of the
// board, a friend who was in front and is now behind, while the player's
// own time went up (so it is the player's training that did it, never a
// friend's deleted post). The one passed last (the highest) is named.
export function passedFriend(before: readonly StandRow[] | null | undefined, after: readonly StandRow[]): string | null {
  const was = before?.find((r) => r.me);
  const now = after.find((r) => r.me);
  if (!before || !was || !now || !(now.minutes > was.minutes)) return null;
  const passed = after
    .filter((r) => !r.me && r.minutes > 0 && r.minutes < now.minutes)
    .filter((r) => {
      const then = before.find((b) => !b.me && b.name === r.name);
      return then !== undefined && then.minutes > was.minutes;
    })
    .sort((a, b) => b.minutes - a.minutes);
  return passed[0] ? firstOf(passed[0].name) : null;
}

// RIGHT AFTER YOUR OWN TRAINING LANDS (the voice guide, moment 2): between
// two reads of the board, the player's own time went up, so a gold line
// says so. A friend passed is named; otherwise one of three lines, with the
// minutes the training added. Held still by the seed (the day and the new
// total), so a redraw never swaps it. Null when the player's time did not go
// up (the first read included).
export { landedLines };
export function landedLine(before: readonly StandRow[] | null | undefined, after: readonly StandRow[], day: string): string | null {
  const was = before?.find((r) => r.me);
  const now = after.find((r) => r.me);
  if (!before || !was || !now || !(now.minutes > was.minutes)) return null;
  const who = passedFriend(before, after);
  if (who) return `You just passed ${who}.`;
  return pickLine(landedLines(now.minutes - was.minutes), `landed:${day}:${now.minutes}`);
}
