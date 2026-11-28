// THE WEEKLY CLUB MATCHUP (Nov 24 2026, migration 083): the pure rules.
//
// Every Monday each club is matched with another club. All week both clubs
// train. After Sunday ends in New York, the club with more training time
// PER PLAYER wins the week. It needs no field and no coach.
//
//   WHO      clubs that have not ended with at least MATCHUP_MIN_PLAYERS
//            members (the club ranking's own minimum)
//   PAIRING  the same county first; a club left over is matched with a
//            left-over club from another county; one left after that has
//            no matchup that week. The order is worked out from the week's
//            Monday, so running it again pairs the same way, and nobody
//            plays the same club two weeks running while another choice
//            exists.
//   SCORE    training minutes that week (gym never counts; the day's 8
//            hours is held where a log is written), divided by the players
//            the club had WHEN IT WAS MATCHED. That list is stored with the
//            matchup, so adding or removing a player mid-week changes
//            nothing; a player who joins mid-week counts from next Monday.
//   RESULT   decided once, after Sunday: more time per player wins; equal
//            to the minute is a draw. Stored, never worked out again.
//   RECORD   a club's matchup record is its own line. Real games keep
//            their own record and the county ranking is untouched.
//
// The words a player reads are in club-matchup-words.ts.
import { fmtDuration } from "./time-trained";
import { shiftDay } from "./time";
import { RANKING_MIN_MEMBERS, weekOf } from "./tracker";
import {
  MATCHUP_NONE_LINE,
  MATCHUP_SOON_LINE,
  matchupAheadLine,
  matchupCardLine,
  matchupRecordLine,
  matchupResultLine,
  matchupSmallLine,
  type MatchupResult,
} from "./club-matchup-words";

export type { MatchupResult };

// The owner may want to change these three.
export const MATCHUP_MIN_PLAYERS = RANKING_MIN_MEMBERS; // players a club needs to be matched
export const MATCHUP_CROSS_COUNTY = true; // a left-over club plays a left-over club from another county
// A draw is two times per player equal to the whole minute.
export function perPlayerMinutes(totalMinutes: number, players: number): number {
  return players > 0 ? Math.round(Math.max(0, totalMinutes) / players) : 0;
}

// One club's side of one week, as stored (083). opponent_id null: the
// club was there on Monday and no other club was left to play.
export type MatchupRow = {
  week_monday: string;
  club_id: string;
  opponent_id: string | null;
  roster: string[];
  minutes: number | null;
  players: number | null;
  result: MatchupResult | null;
  decided_at: string | null;
};

// ---- Pairing ---------------------------------------------------------------

// FNV-1a, the same small hash the crest colours use.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// The week's own order of the clubs: a shuffle that is the same every time
// it is asked for the same Monday.
export function weekOrder(ids: string[], monday: string): string[] {
  return [...new Set(ids)].sort((x, y) => hash(`${monday}:${x}`) - hash(`${monday}:${y}`) || x.localeCompare(y));
}

type Paired = { pairs: [string, string][]; left: string[]; forced: [string, string] | null };

// Pair a list in its order. A club takes the first club after it that it
// did not play last week. When the only club left is last week's opponent,
// the two trade partners with the pair before them; with no pair before
// them they are `forced`: a rematch nobody inside this list can avoid.
function pairList(ids: string[], last: ReadonlyMap<string, string>): Paired {
  const rematch = (x: string, y: string) => last.get(x) === y || last.get(y) === x;
  const free = [...ids];
  const pairs: [string, string][] = [];
  let forced: [string, string] | null = null;
  while (free.length >= 2) {
    const x = free.shift()!;
    const j = free.findIndex((y) => !rematch(x, y));
    if (j >= 0) {
      pairs.push([x, free.splice(j, 1)[0]]);
      continue;
    }
    // every club left played x last week, so exactly one is left
    const y = free.shift()!;
    const before = pairs.pop();
    if (!before) forced = [x, y];
    else if (!rematch(before[0], x) && !rematch(before[1], y)) pairs.push([before[0], x], [before[1], y]);
    else if (!rematch(before[0], y) && !rematch(before[1], x)) pairs.push([before[0], y], [before[1], x]);
    else {
      pairs.push(before);
      forced = [x, y];
    }
  }
  return { pairs, left: free, forced };
}

export type Pairing = { pairs: [string, string][]; alone: string[] };

// This week's matchups. `clubs` are the clubs that can be matched (the
// caller has already left out ended and small ones); `lastOpponent` is who
// each club played last week.
export function pairClubs(input: {
  clubs: { id: string; county: string | null }[];
  monday: string;
  lastOpponent: ReadonlyMap<string, string>;
  crossCounty?: boolean;
}): Pairing {
  const cross = input.crossCounty ?? MATCHUP_CROSS_COUNTY;
  const countyOf = new Map(input.clubs.map((c) => [c.id, c.county]));
  const order = weekOrder(input.clubs.map((c) => c.id), input.monday);
  const groups = new Map<string, string[]>();
  const pool: string[] = []; // left over, to be matched across counties
  for (const id of order) {
    const county = countyOf.get(id) ?? null;
    if (!county) pool.push(id); // a club with no county has no county to play in
    else groups.set(county, [...(groups.get(county) ?? []), id]);
  }
  const pairs: [string, string][] = [];
  for (const ids of groups.values()) {
    const g = pairList(ids, input.lastOpponent);
    pairs.push(...g.pairs);
    pool.push(...g.left);
    // the only two clubs of a county, a week after they played each other:
    // another choice may exist in another county
    if (g.forced && cross) pool.push(...g.forced);
    else if (g.forced) pairs.push(g.forced);
  }
  if (!cross) return { pairs: sorted(pairs), alone: weekOrder(pool, input.monday) };
  const rest = pairList(weekOrder(pool, input.monday), input.lastOpponent);
  pairs.push(...rest.pairs);
  if (rest.forced) pairs.push(rest.forced); // no other choice anywhere
  return { pairs: sorted(pairs), alone: rest.left };
}

const sorted = (pairs: [string, string][]): [string, string][] =>
  pairs.map(([a, b]): [string, string] => (a < b ? [a, b] : [b, a])).sort((x, y) => x[0].localeCompare(y[0]));

// The rows a pairing stores: two for a matchup (one a club), one for a
// club with nobody to play.
export function matchupRows(input: { pairing: Pairing; monday: string; rosterOf: (clubId: string) => string[] }): MatchupRow[] {
  const row = (club: string, opponent: string | null): MatchupRow => ({
    week_monday: input.monday,
    club_id: club,
    opponent_id: opponent,
    roster: [...new Set(input.rosterOf(club))].sort(),
    minutes: null,
    players: null,
    result: null,
    decided_at: null,
  });
  return [...input.pairing.pairs.flatMap(([a, b]) => [row(a, b), row(b, a)]), ...input.pairing.alone.map((a) => row(a, null))];
}

// Who each club played, from a week's stored rows.
export function opponentsOf(rows: Pick<MatchupRow, "club_id" | "opponent_id">[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) if (r.opponent_id) out.set(r.club_id, r.opponent_id);
  return out;
}

// ---- Weeks -----------------------------------------------------------------

export function matchupMonday(today: string): string {
  return weekOf(today).monday;
}

export function lastMonday(monday: string): string {
  return shiftDay(monday, -7);
}

// A week can be decided once its Sunday has ended in New York.
export function weekIsOver(weekMonday: string, today: string): boolean {
  return shiftDay(weekMonday, 6) < today;
}

// Matching happens on Monday. A week that has no matchups at all yet (the
// hourly run was down on Monday) is caught up on the next run, any day.
export function matchingDue(input: { today: string; weekHasRows: boolean }): boolean {
  return input.today === matchupMonday(input.today) || !input.weekHasRows;
}

// ---- The score and the result ----------------------------------------------

export type MatchupLog = { profile_id: string; trained_on: string; minutes: number; kind: string };

// A side's training minutes for its week: training only, inside the week,
// by a player on the stored list.
export function sideMinutes(row: Pick<MatchupRow, "week_monday" | "roster">, logs: MatchupLog[]): number {
  const on = new Set(row.roster);
  const sunday = shiftDay(row.week_monday, 6);
  return logs.reduce(
    (s, l) => (l.kind === "training" && on.has(l.profile_id) && l.trained_on >= row.week_monday && l.trained_on <= sunday ? s + l.minutes : s),
    0
  );
}

export function resultOf(mine: number, theirs: number): MatchupResult {
  return mine > theirs ? "win" : mine < theirs ? "loss" : "draw";
}

const mirror = (r: MatchupResult): MatchupResult => (r === "win" ? "loss" : r === "loss" ? "win" : "draw");

export type Decision = { club_id: string; minutes: number; players: number; result: MatchupResult };

// The result of one matchup, for the sides not decided yet. A side already
// decided is never touched, and the other side takes the mirror of it, so
// the two can never disagree.
export function decide(input: { a: MatchupRow; b: MatchupRow; logs: MatchupLog[] }): Decision[] {
  const { a, b } = input;
  const side = (r: MatchupRow) => {
    const players = r.players ?? r.roster.length;
    const minutes = r.minutes ?? sideMinutes(r, input.logs);
    return { players, minutes, per: perPlayerMinutes(minutes, players) };
  };
  const [sa, sb] = [side(a), side(b)];
  const resultA = a.result ?? (b.result ? mirror(b.result) : resultOf(sa.per, sb.per));
  const out: Decision[] = [];
  if (!a.decided_at) out.push({ club_id: a.club_id, minutes: sa.minutes, players: sa.players, result: resultA });
  if (!b.decided_at) out.push({ club_id: b.club_id, minutes: sb.minutes, players: sb.players, result: mirror(resultA) });
  return out;
}

// ---- The record ------------------------------------------------------------

export type MatchupRecord = { wins: number; losses: number; draws: number };

export function matchupRecord(rows: Pick<MatchupRow, "result">[]): MatchupRecord {
  const r = { wins: 0, losses: 0, draws: 0 };
  for (const x of rows) {
    if (x.result === "win") r.wins++;
    else if (x.result === "loss") r.losses++;
    else if (x.result === "draw") r.draws++;
  }
  return r;
}

// ---- What a screen shows ---------------------------------------------------

export type MatchupSide = { id: string; name: string; minutes: number; time: string };

// The card under a club's week. "on": this week's matchup, with who is
// ahead. "over": the week is decided and the next one has not started.
// "none": one calm line (nobody to play, the club is still small, or it
// starts Monday). `last` is last week's result, said under this week's.
export type MatchupView = {
  state: "on" | "over" | "none";
  mine: MatchupSide | null;
  theirs: MatchupSide | null;
  line: string;
  last: string | null;
  // the one line for the club's card on the Clubs tab; null when there is
  // no matchup on
  cardLine: string | null;
  recordLine: string;
  // CHAMPS OF THE WEEK: the club won last week's matchup. A gold mark on
  // its card and its page for the week after the win, from the stored
  // result alone.
  champs: boolean;
};

const sideView = (id: string, name: string, per: number): MatchupSide => ({ id, name, minutes: per, time: fmtDuration(per) });

export function matchupView(input: {
  club: { id: string; name: string; members: number };
  today: string;
  // this club's rows, any order: this week's, last week's, older ones
  rows: MatchupRow[];
  // the opponent's rows for the same weeks (their stored list and, once
  // decided, their minutes)
  theirRows: MatchupRow[];
  nameOf: (clubId: string) => string;
  // training since last week's Monday by players of either stored list
  logs: MatchupLog[];
}): MatchupView {
  const monday = matchupMonday(input.today);
  const mineOf = (week: string) => input.rows.find((r) => r.week_monday === week) ?? null;
  const theirsOf = (row: MatchupRow) =>
    input.theirRows.find((r) => r.week_monday === row.week_monday && r.club_id === row.opponent_id) ?? null;
  const recordLine = matchupRecordLine(matchupRecord(input.rows));

  // last week's result, when it was decided
  const before = mineOf(lastMonday(monday));
  const last = before?.result && before.opponent_id ? matchupResultLine(before.result, input.nameOf(before.opponent_id)) : null;
  const champs = Boolean(before?.opponent_id) && before?.result === "win";
  const decidedSides = (row: MatchupRow) => {
    const other = theirsOf(row);
    return {
      mine: sideView(input.club.id, input.club.name, perPlayerMinutes(row.minutes ?? 0, row.players ?? row.roster.length)),
      theirs: sideView(row.opponent_id!, input.nameOf(row.opponent_id!), perPlayerMinutes(other?.minutes ?? 0, other?.players ?? other?.roster.length ?? 0)),
    };
  };

  const now = mineOf(monday);
  // The matchup that is on: this week's, or (for the first hour of a
  // Monday, before the hourly run has decided it) last week's as it ended.
  const live = now?.opponent_id ? now : !now && before?.opponent_id && !before.result ? before : null;
  if (live?.opponent_id) {
    const other = theirsOf(live);
    const otherName = input.nameOf(live.opponent_id);
    const mine = sideView(input.club.id, input.club.name, perPlayerMinutes(sideMinutes(live, input.logs), live.roster.length));
    const theirs = sideView(live.opponent_id, otherName, other ? perPlayerMinutes(sideMinutes(other, input.logs), other.roster.length) : 0);
    return {
      state: "on",
      mine,
      theirs,
      line: matchupAheadLine({ mine: mine.minutes, theirs: theirs.minutes, other: otherName, club: input.club.name, seed: `${input.club.id}:${input.today}` }),
      last: live === now ? last : null,
      cardLine: matchupCardLine(input.club.name, otherName),
      recordLine,
      champs,
    };
  }
  // Monday, before this week's matching has run: last week's result stands
  if (!now && before?.result && before.opponent_id) {
    return { state: "over", ...decidedSides(before), line: last!, last: null, cardLine: null, recordLine, champs };
  }
  const line = now
    ? MATCHUP_NONE_LINE
    : input.club.members < MATCHUP_MIN_PLAYERS
      ? matchupSmallLine(MATCHUP_MIN_PLAYERS)
      : MATCHUP_SOON_LINE;
  return { state: "none", mine: null, theirs: null, line, last, cardLine: null, recordLine, champs };
}

// ---- Champs of the week -----------------------------------------------------

// The winners of one decided week, each with the club it beat and by how
// many minutes per player. A draw has no winner; a club with nobody to
// play won nothing; a side whose other side is missing is left out (the
// gap cannot be said truthfully).
export type Champs = { clubId: string; otherId: string; roster: string[]; gap: number };

export function champsOf(rows: MatchupRow[]): Champs[] {
  const by = new Map(rows.map((r) => [`${r.week_monday}:${r.club_id}`, r]));
  const out: Champs[] = [];
  for (const r of rows) {
    if (r.result !== "win" || !r.opponent_id || !r.decided_at) continue;
    const other = by.get(`${r.week_monday}:${r.opponent_id}`);
    if (!other || !other.decided_at) continue;
    const gap =
      perPlayerMinutes(r.minutes ?? 0, r.players ?? r.roster.length) -
      perPlayerMinutes(other.minutes ?? 0, other.players ?? other.roster.length);
    if (gap > 0) out.push({ clubId: r.club_id, otherId: r.opponent_id, roster: r.roster, gap });
  }
  return out;
}

// When the winners are told: Monday in New York, from 5:00 PM and never
// after 9:00 PM. (A new week is announced from 4:00 PM, lib/elite/
// announce.ts: the two never land on top of each other.) A Monday whose
// window passed with the hourly run down sends nothing: news of last week
// on a Tuesday is not news.
export const CHAMPS_FROM_HOUR = 17;
export const CHAMPS_UNTIL_HOUR = 21;
export function champsDue(input: { today: string; hour: number }): boolean {
  return input.today === matchupMonday(input.today) && input.hour >= CHAMPS_FROM_HOUR && input.hour < CHAMPS_UNTIL_HOUR;
}
