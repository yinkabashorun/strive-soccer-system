// Clubs as teams (Nov 22 2026, migration 077): the pure rules.
//
// Coach Yinka: "make your team and hold your spot for the biggest strive
// events and plan pickup games vs other clubs in your area". The owner's
// rules for how: it runs itself at scale (nothing waits on a Strive coach
// or a Strive event), it is super low friction, and the liability is
// carried by the way it is built, the way Strava and Meetup do it:
//
//   - CLOSED GROUPS ONLY. A club's training session is seen by its
//     members; a game is club against club and seen by the members of the
//     two clubs. Nobody else sees or joins either (mayViewPlan).
//   - NOT THE ORGANIZER. Every session and game is "Organized by" a club,
//     never by Strive. A captain accepts that once before planning; a
//     player accepts once before their first "I'm in" (the two sheets).
//   - A PUBLIC PLACE, NEVER A HOME. A place is a typed field or park name;
//     anything that looks like a street address is refused (cleanPlace).
//   - No messaging between clubs, no direct messages. Results confirm
//     themselves after 24 hours (resultState); a report reaches the coach
//     queue so a coach can act, but nothing waits on one.
//
// What other clubs see of a club, and only captains in its county when it
// is open to games: its name, crest, county, record and player count.
// Never a list of players.
import { fmtDuration } from "./time-trained";
import { isOffensive } from "./text-filter";
import { ageFromBirth, blockedEitherWay, cleanClubName, firstNameOf, type Birth, type Block, type Kind } from "./tracker";

// ---- Counties ------------------------------------------------------------

// The DMV, as a fixed list: every Maryland county and Baltimore City, the
// District, and Northern Virginia with the counties and independent cities
// around it. A club picks one; nobody types a place. The id's shape is held
// by the database too (077, elite_tracker_clubs_county_shape).
export type County = { id: string; name: string; short: string; state: "DC" | "MD" | "VA" };

const c = (state: County["state"], slug: string, name: string, short = name.replace(/ County$/, "")): County => ({
  id: `${state.toLowerCase()}-${slug}`,
  name,
  short,
  state,
});

export const COUNTIES: readonly County[] = [
  c("DC", "washington", "District of Columbia", "DC"),
  // Maryland: all 23 counties and Baltimore City
  c("MD", "allegany", "Allegany County"),
  c("MD", "anne-arundel", "Anne Arundel County"),
  c("MD", "baltimore-county", "Baltimore County", "Baltimore County"),
  c("MD", "baltimore-city", "Baltimore City"),
  c("MD", "calvert", "Calvert County"),
  c("MD", "caroline", "Caroline County"),
  c("MD", "carroll", "Carroll County"),
  c("MD", "cecil", "Cecil County"),
  c("MD", "charles", "Charles County"),
  c("MD", "dorchester", "Dorchester County"),
  c("MD", "frederick", "Frederick County, MD", "Frederick"),
  c("MD", "garrett", "Garrett County"),
  c("MD", "harford", "Harford County"),
  c("MD", "howard", "Howard County"),
  c("MD", "kent", "Kent County"),
  c("MD", "montgomery", "Montgomery County"),
  c("MD", "prince-georges", "Prince George's County"),
  c("MD", "queen-annes", "Queen Anne's County"),
  c("MD", "st-marys", "St. Mary's County"),
  c("MD", "somerset", "Somerset County"),
  c("MD", "talbot", "Talbot County"),
  c("MD", "washington", "Washington County"),
  c("MD", "wicomico", "Wicomico County"),
  c("MD", "worcester", "Worcester County"),
  // Virginia: Northern Virginia and the counties and cities around it
  c("VA", "arlington", "Arlington County"),
  c("VA", "fairfax-county", "Fairfax County", "Fairfax County"),
  c("VA", "loudoun", "Loudoun County"),
  c("VA", "prince-william", "Prince William County"),
  c("VA", "stafford", "Stafford County"),
  c("VA", "fauquier", "Fauquier County"),
  c("VA", "spotsylvania", "Spotsylvania County"),
  c("VA", "culpeper", "Culpeper County"),
  c("VA", "clarke", "Clarke County"),
  c("VA", "frederick", "Frederick County, VA", "Frederick"),
  c("VA", "warren", "Warren County"),
  c("VA", "king-george", "King George County"),
  c("VA", "alexandria", "City of Alexandria", "Alexandria"),
  c("VA", "fairfax-city", "City of Fairfax", "Fairfax City"),
  c("VA", "falls-church", "City of Falls Church", "Falls Church"),
  c("VA", "manassas", "City of Manassas", "Manassas"),
  c("VA", "manassas-park", "City of Manassas Park", "Manassas Park"),
  c("VA", "fredericksburg", "City of Fredericksburg", "Fredericksburg"),
  c("VA", "winchester", "City of Winchester", "Winchester"),
];

const BY_ID = new Map(COUNTIES.map((x) => [x.id, x]));

// A county id from the list, or null. Anything typed is nobody's county.
export function cleanCounty(raw: unknown): string | null {
  return typeof raw === "string" && BY_ID.has(raw) ? raw : null;
}

export function countyOf(id: string | null | undefined): County | null {
  return (id && BY_ID.get(id)) || null;
}

export function countyName(id: string | null | undefined): string | null {
  return countyOf(id)?.name ?? null;
}

// The three states, for the county picker's groups.
export const COUNTY_GROUPS: { state: County["state"]; label: string; counties: County[] }[] = [
  { state: "VA", label: "Virginia", counties: COUNTIES.filter((x) => x.state === "VA") },
  { state: "MD", label: "Maryland", counties: COUNTIES.filter((x) => x.state === "MD") },
  { state: "DC", label: "DC", counties: COUNTIES.filter((x) => x.state === "DC") },
];

export const COUNTY_MESSAGE = "Pick your club's county from the list.";
export const OPEN_NEEDS_COUNTY_MESSAGE = "Pick your club's county first. Clubs only play clubs in the same county.";

// ---- Clubs as the rules see them --------------------------------------------

export type TeamClub = {
  id: string;
  name: string;
  county: string | null;
  open: boolean; // open to games
  archived: boolean;
  members: number;
};

// ---- Plans: club training and games --------------------------------------------

// A plan is a club's training session (members only) or a game between two
// clubs. It is organized by the club, never by Strive, and only the
// members of the clubs involved ever see it.
export type PlanKind = "training" | "game";
export type PlanStatus = "pending" | "on" | "passed" | "cancelled";
export type ScoreAnswer = "confirmed" | "disputed";

export type PlanRow = {
  id: string;
  kind: PlanKind;
  club_id: string;
  opponent_id: string | null;
  title: string | null;
  starts_at: string;
  minutes: number;
  place: string;
  status: PlanStatus;
  score_by_club: string | null;
  score_club: number | null;
  score_opponent: number | null;
  score_entered_at: string | null;
  score_answer: ScoreAnswer | null;
};

// A club has this many game requests waiting on other captains at most
// (one constant; the database holds the same number, 077).
export const PENDING_GAMES_MAX = 3;
export const PLAN_MINUTES = [30, 45, 60, 90, 120] as const;
export const PLAN_MINUTES_DEFAULT = 60;
export const PLAN_DAYS_AHEAD = 60; // how far ahead a plan can be made
export const PLAN_TITLE_MAX = 40;
export const PLACE_MAX = 60;
export const PLACE_HINT = "A public field or park. Never a home.";
export const PLACE_MESSAGE = "Name a public field or park and its town, up to 60 letters. No street addresses, links or phone numbers.";

// Street words that, after a house number, make a street address.
const STREET =
  "st|street|ave|avenue|rd|road|dr|drive|ct|court|ln|lane|way|blvd|boulevard|pl|place|ter|terrace|cir|circle|pkwy|parkway|hwy|highway|trl|trail|pike";
const ADDRESS_AT_START = /^\s*\d+[a-z]?\s+\w+/i;
const ADDRESS_ANYWHERE = new RegExp(`\\b\\d{1,6}[a-z]?\\s+(?:[\\w.'-]+\\s+){0,4}(?:${STREET})\\b`, "i");

// Does this look like a street address? A house number at the start
// ("12 Oak"), or a number followed by a street word anywhere ("Field by
// 4410 Bristow Rd"). "St. Mary's Park" and "Field 3, Bull Run Park" are not.
export function looksLikeAddress(text: string): boolean {
  return ADDRESS_AT_START.test(text) || ADDRESS_ANYWHERE.test(text);
}

// Start times a captain can pick: every half hour, 6:00 AM to 9:30 PM New
// York time.
export const PLAN_TIMES: readonly string[] = [...Array(32).keys()].map((i) => {
  const h = 6 + Math.floor(i / 2);
  return `${String(h).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
});
export const PLAN_TIME_DEFAULT = "18:00";

// "6:00 PM" for "18:00".
export function timeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// A place: plain words, one line, 60 letters at most, never an address, a
// link, a handle, a run of digits (a phone number, a zip) or anything the
// word filter stops.
export function cleanPlace(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const place = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (place.length < 2 || place.length > PLACE_MAX) return null;
  if (/https?:|www\.|:\/\/|@|\.(com|net|org|io|co|gg|me|ly|app|link|tv)\b/i.test(place)) return null;
  if ((place.match(/\d/g) ?? []).length > 4) return null;
  if (looksLikeAddress(place)) return null;
  if (isOffensive(place)) return null;
  return place;
}

// A session's optional title: the club-name rule (40 letters, no links,
// the word filter).
export function cleanPlanTitle(raw: unknown): string | null {
  if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) return null;
  return cleanClubName(raw);
}

export function cleanPlanMinutes(raw: unknown): number | null {
  const n = Number(raw);
  return (PLAN_MINUTES as readonly number[]).includes(n) ? n : null;
}

// When a plan starts: in the future, and no more than 60 days ahead.
export function cleanStart(raw: unknown, nowMs: number): string | null {
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t) || t <= nowMs || t > nowMs + PLAN_DAYS_AHEAD * 86_400_000) return null;
  return new Date(t).toISOString();
}
export const START_MESSAGE = `Pick a day and time in the next ${PLAN_DAYS_AHEAD} days.`;

// The New York wall time a phone sends ("2026-12-05", "18:30") as an
// instant, so a plan is never off by the visitor's own time zone.
export function nyInstant(day: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const guess = Date.parse(`${day}T${time}:00Z`);
  if (Number.isNaN(guess)) return null;
  // the New York offset on that day, worked out from the wall clock
  for (const offset of [4, 5]) {
    const t = guess + offset * 3_600_000;
    const wall = new Date(t).toLocaleString("en-CA", { timeZone: "America/New_York", hour12: false });
    const [d, hm] = wall.split(", ");
    if (d === day && hm.slice(0, 5).replace(/^24/, "00") === time) return new Date(t).toISOString();
  }
  return null;
}

// Who may see a plan: the members of the club that organized it, and for a
// game the members of the other club once that club's captain accepted.
// Nobody else, ever: there are no public sessions or games. Coaches see
// everything (for the report queue).
export function mayViewPlan(
  plan: Pick<PlanRow, "kind" | "club_id" | "opponent_id" | "status">,
  viewer: { clubIds: ReadonlySet<string>; staff: boolean }
): boolean {
  if (viewer.staff) return true;
  if (viewer.clubIds.has(plan.club_id)) return true;
  if (plan.kind === "game" && plan.opponent_id && viewer.clubIds.has(plan.opponent_id)) {
    return plan.status === "on";
  }
  return false;
}

export type PlanRefusal =
  | "not_captain"
  | "ended"
  | "self"
  | "no_county"
  | "not_open"
  | "other_county"
  | "too_many";

export const PLAN_REFUSED: Record<PlanRefusal, string> = {
  not_captain: "Only the club's captain can plan for the club.",
  ended: "That club has ended.",
  self: "A club cannot play itself.",
  no_county: "Pick your club's county first. Clubs only play clubs in the same county.",
  not_open: "That club is not taking games right now.",
  other_county: "Clubs only play clubs in the same county.",
  too_many: `Your club has ${PENDING_GAMES_MAX} game requests waiting. Wait for an answer or cancel one first.`,
};

// May the captain of `from` send `to` a game? Same county, the other club
// open to games, neither ended, and fewer than three requests waiting.
// A club already played may be sent another game whatever its switch and
// county say now (the two captains know each other's clubs).
export function gameDecision(input: {
  viewerIsCaptain: boolean;
  from: TeamClub;
  to: TeamClub;
  pendingFrom: number;
  playedBefore?: boolean;
}): PlanRefusal | "ok" {
  const { from, to } = input;
  if (!input.viewerIsCaptain) return "not_captain";
  if (from.id === to.id) return "self";
  if (from.archived || to.archived) return "ended";
  if (!input.playedBefore) {
    if (!from.county) return "no_county";
    if (!to.open || !to.county) return "not_open";
    if (from.county !== to.county) return "other_county";
  }
  if (input.pendingFrom >= PENDING_GAMES_MAX) return "too_many";
  return "ok";
}

export function pendingGamesOf(rows: Pick<PlanRow, "kind" | "club_id" | "status">[], clubId: string): number {
  return rows.filter((r) => r.kind === "game" && r.status === "pending" && r.club_id === clubId).length;
}

// The clubs a club has played: every game that is on, either side.
export function playedOpponents(rows: Pick<PlanRow, "kind" | "status" | "club_id" | "opponent_id" | "starts_at">[], clubId: string): string[] {
  const out = new Set<string>();
  for (const r of rows) {
    if (r.kind !== "game" || r.status !== "on" || !r.opponent_id) continue;
    if (r.club_id === clubId) out.add(r.opponent_id);
    else if (r.opponent_id === clubId) out.add(r.club_id);
  }
  return [...out];
}

// The other captain answers a game request while it waits.
export function mayAnswerGame(plan: Pick<PlanRow, "kind" | "status" | "opponent_id">, captainOf: ReadonlySet<string>): boolean {
  return plan.kind === "game" && plan.status === "pending" && Boolean(plan.opponent_id) && captainOf.has(plan.opponent_id!);
}

// A captain of a club involved calls it off before it starts; a coach any
// time.
export function mayCancel(
  plan: Pick<PlanRow, "kind" | "status" | "club_id" | "opponent_id" | "starts_at">,
  who: { captainOf: ReadonlySet<string>; staff: boolean },
  nowMs: number
): boolean {
  if (plan.status === "cancelled" || plan.status === "passed") return false;
  if (who.staff) return true;
  if (Date.parse(plan.starts_at) <= nowMs) return false;
  if (who.captainOf.has(plan.club_id)) return true;
  return plan.kind === "game" && plan.status === "on" && Boolean(plan.opponent_id) && who.captainOf.has(plan.opponent_id!);
}

// "I'm in": a member of a club involved, on a plan that is on and has not
// ended, after the one-time player sheet.
export function mayJoin(
  plan: Pick<PlanRow, "kind" | "status" | "club_id" | "opponent_id" | "starts_at" | "minutes">,
  viewerClubIds: ReadonlySet<string>,
  nowMs: number
): boolean {
  if (plan.status !== "on") return false;
  if (Date.parse(plan.starts_at) + plan.minutes * 60_000 <= nowMs) return false;
  return mayViewPlan(plan, { clubIds: viewerClubIds, staff: false });
}

// Which side a player is in it for: their own club if they organized it,
// else the other club.
export function sideOf(plan: Pick<PlanRow, "club_id" | "opponent_id">, viewerClubIds: ReadonlySet<string>): string | null {
  if (viewerClubIds.has(plan.club_id)) return plan.club_id;
  if (plan.opponent_id && viewerClubIds.has(plan.opponent_id)) return plan.opponent_id;
  return null;
}

// Who of the players in it a viewer is shown by name: only players in for
// the viewer's own club, never across a block. Everyone else is a count.
export function namesShown<T extends { profile_id: string; club_id: string }>(
  ins: T[],
  viewer: { id: string; clubIds: ReadonlySet<string>; blocks: Block[] }
): T[] {
  return ins.filter(
    (i) => i.profile_id === viewer.id || (viewer.clubIds.has(i.club_id) && !blockedEitherWay(viewer.blocks, viewer.id, i.profile_id))
  );
}

export function inCountLine(n: number): string {
  return `${n} in`;
}

export function organizedBy(club: string): string {
  return `Organized by ${club}`;
}

// ---- One session or game, as a card ------------------------------------------------

// What a screen draws for one plan (built by club-teams-server.ts toCard,
// only ever for a viewer who may see the plan). The type lives here, with
// the pure rules, so the iPhone app's contract can name it.
export type PlanCard = {
  id: string;
  kind: PlanKind;
  title: string | null;
  organizer: { id: string; name: string };
  opponent: { id: string; name: string } | null;
  when: string; // "Tue, Nov 24, 6:00 PM"
  minutes: number;
  place: string;
  status: PlanStatus;
  started: boolean;
  ins: number;
  names: string[]; // only players in for the viewer's own club(s), never across a block
  imIn: boolean;
  canJoin: boolean;
  canCancel: boolean;
  canAnswer: boolean; // the other captain, on a game request
  result: null | {
    state: ResultState;
    score: [number, number] | null; // organizer first
    line: string | null;
    canEnter: boolean;
    canAnswer: boolean;
  };
};

// "Tue, Nov 24 at 6:00 PM", New York time: when a plan starts, as a
// notification says it.
export function planDayAt(startsAt: string): string {
  const d = new Date(startsAt);
  const day = d.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}

// What a plan is, in a few words, as one of its clubs reads it.
export function planWhat(plan: { kind: PlanKind; title: string | null }, otherClub: string | null): string {
  if (plan.kind === "training") return plan.title ?? "Club training";
  return otherClub ? `Game against ${otherClub}` : "Game";
}

// The small line over a card: what it is and who it is for.
export function planLabel(card: Pick<PlanCard, "kind" | "status" | "result">): string {
  if (card.kind === "training") return "Club training · Members only";
  if (card.status === "pending") return "Game · Waiting on the other captain";
  return card.result?.state === "confirmed" ? "Game · Final" : "Game · Club vs club";
}

// The two clubs of a card as one club's members read it: their own first.
export function planSides(card: Pick<PlanCard, "organizer" | "opponent">, perspective: string) {
  const ours = card.opponent && card.opponent.id === perspective ? card.opponent : card.organizer;
  const theirs = card.opponent ? (ours.id === card.organizer.id ? card.opponent : card.organizer) : null;
  return { ours, theirs };
}

// The score with the reader's own club first.
export function planScore(card: Pick<PlanCard, "organizer" | "opponent" | "result">, perspective: string): [number, number] | null {
  const score = card.result?.score;
  if (!score) return null;
  return planSides(card, perspective).ours.id === card.organizer.id ? score : [score[1], score[0]];
}

// ---- The result of a game ---------------------------------------------------------

export const CONFIRM_HOURS = 24; // the owner's number, Nov 22 2026

export type ResultState = "none" | "waiting" | "confirmed" | "disputed";

// Where a game's result stands. A score the other captain has not answered
// in 24 hours (CONFIRM_HOURS) counts as confirmed, worked out here whenever it is read, so
// nothing has to run on a clock and nothing waits on a coach.
export function resultState(plan: Pick<PlanRow, "score_entered_at" | "score_answer">, nowMs: number): ResultState {
  if (!plan.score_entered_at) return "none";
  if (plan.score_answer === "confirmed") return "confirmed";
  if (plan.score_answer === "disputed") return "disputed";
  return Date.parse(plan.score_entered_at) + CONFIRM_HOURS * 3_600_000 <= nowMs ? "confirmed" : "waiting";
}

// Either captain enters the score once the game has started, if nobody has.
export function mayEnterScore(
  plan: Pick<PlanRow, "kind" | "status" | "club_id" | "opponent_id" | "starts_at" | "score_entered_at">,
  captainOf: ReadonlySet<string>,
  nowMs: number
): boolean {
  if (plan.kind !== "game" || plan.status !== "on" || plan.score_entered_at) return false;
  if (Date.parse(plan.starts_at) > nowMs) return false;
  return captainOf.has(plan.club_id) || (Boolean(plan.opponent_id) && captainOf.has(plan.opponent_id!));
}

// The OTHER captain confirms it or says it is not right, within CONFIRM_HOURS.
export function mayAnswerScore(
  plan: Pick<PlanRow, "kind" | "club_id" | "opponent_id" | "score_by_club" | "score_entered_at" | "score_answer">,
  captainOf: ReadonlySet<string>,
  nowMs: number
): boolean {
  if (plan.kind !== "game" || resultState(plan, nowMs) !== "waiting" || !plan.score_by_club) return false;
  const other = plan.score_by_club === plan.club_id ? plan.opponent_id : plan.club_id;
  return Boolean(other) && captainOf.has(other!);
}

// A score a captain types: a whole number from 0 to 99.
export function cleanScore(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}
export const SCORE_MESSAGE = "Enter both scores, whole numbers from 0 to 99.";

export function resultLine(state: ResultState, enteredByOther: boolean): string | null {
  if (state === "waiting")
    return enteredByOther
      ? `Is this right? It counts in ${CONFIRM_HOURS} hours unless you say no.`
      : `Waiting on the other captain. It counts in ${CONFIRM_HOURS} hours.`;
  if (state === "disputed") return "The captains did not agree, so it does not count.";
  if (state === "confirmed") return "Final.";
  return null;
}

// ---- Records and the county ranking -------------------------------------------

export type ClubRecord = { wins: number; losses: number; draws: number; played: number };
const EMPTY: ClubRecord = { wins: 0, losses: 0, draws: 0, played: 0 };

// Every club's record, from confirmed results only (answered yes, or 24
// hours with no answer). A disputed, waiting or cancelled game is nobody's
// win or loss.
export function recordsOf(rows: Pick<PlanRow, "kind" | "status" | "club_id" | "opponent_id" | "score_club" | "score_opponent" | "score_entered_at" | "score_answer">[], nowMs: number): Map<string, ClubRecord> {
  const out = new Map<string, ClubRecord>();
  const add = (id: string, k: "wins" | "losses" | "draws") => {
    const cur = out.get(id) ?? { ...EMPTY };
    out.set(id, { ...cur, [k]: cur[k] + 1, played: cur.played + 1 });
  };
  for (const r of rows) {
    if (r.kind !== "game" || r.status !== "on" || !r.opponent_id) continue;
    if (resultState(r, nowMs) !== "confirmed" || r.score_club === null || r.score_opponent === null) continue;
    if (r.score_club > r.score_opponent) {
      add(r.club_id, "wins");
      add(r.opponent_id, "losses");
    } else if (r.score_club < r.score_opponent) {
      add(r.opponent_id, "wins");
      add(r.club_id, "losses");
    } else {
      add(r.club_id, "draws");
      add(r.opponent_id, "draws");
    }
  }
  return out;
}

export function recordOf(records: ReadonlyMap<string, ClubRecord>, id: string): ClubRecord {
  return records.get(id) ?? EMPTY;
}

// "4-1", or "4-1-1" once a club has a draw. "New" before its first game.
export function recordLabel(r: ClubRecord): string {
  if (r.played === 0) return "New";
  return r.draws ? `${r.wins}-${r.losses}-${r.draws}` : `${r.wins}-${r.losses}`;
}

// The games record as a plain line, beside the matchup record's own line
// (club-matchup-words.ts): the two are never mixed.
export function gamesRecordLine(r: ClubRecord): string {
  return `Games won: ${r.wins}. Games lost: ${r.losses}. Draws: ${r.draws}.`;
}

export type CountyRow = { id: string; name: string; place: number; record: ClubRecord; members: number; mine: boolean };

// The county ranking: clubs with at least one confirmed game, most wins
// first, then fewer losses, then name. The caller passes only clubs the
// viewer may see (clubs open to games in that county, and the viewer's own).
export function countyRanking(input: {
  clubs: TeamClub[];
  county: string;
  records: ReadonlyMap<string, ClubRecord>;
  mine: ReadonlySet<string>;
}): CountyRow[] {
  return input.clubs
    .filter((x) => x.county === input.county && recordOf(input.records, x.id).played > 0)
    .map((x) => ({ id: x.id, name: x.name, record: recordOf(input.records, x.id), members: x.members, mine: input.mine.has(x.id) }))
    .sort(
      (a, b) =>
        b.record.wins - a.record.wins ||
        a.record.losses - b.record.losses ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
    )
    .map((x, i) => ({ ...x, place: i + 1 }));
}

export function countyPlaceOf(rows: CountyRow[], id: string): number | null {
  return rows.find((r) => r.id === id)?.place ?? null;
}

// Clubs near you (the mock, screen 16): clubs open to games in the county
// of the viewer's club, never the club itself and never one that ended.
// Ranked clubs first in their order, then the rest by name.
export function clubsNearYou(input: { mine: TeamClub; clubs: TeamClub[]; records: ReadonlyMap<string, ClubRecord> }): TeamClub[] {
  if (!input.mine.county) return [];
  const ranked = countyRanking({ clubs: input.clubs, county: input.mine.county, records: input.records, mine: new Set() });
  const place = new Map(ranked.map((r) => [r.id, r.place]));
  return input.clubs
    .filter((x) => x.id !== input.mine.id && x.open && !x.archived && x.county === input.mine.county)
    .sort((a, b) => (place.get(a.id) ?? 1e9) - (place.get(b.id) ?? 1e9) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

// Everything a club near you shows: crest, name, record and players.
// Nothing about any player, ever.
export type NearClubView = { id: string; name: string; record: string; members: number };
export function nearClubView(x: TeamClub, records: ReadonlyMap<string, ClubRecord>): NearClubView {
  return { id: x.id, name: x.name, record: recordLabel(recordOf(records, x.id)), members: x.members };
}

export function placeLine(place: number | null): { big: string; small: string } {
  return place === null ? { big: "New", small: "in the county" } : { big: `#${place}`, small: "in the county" };
}

// ---- The two one-time sheets ------------------------------------------------------

// Bump the version (the date) when the wording changes in a way a player
// should accept again; each acceptance is stored with it (077).
export const PLAY_TERMS_VERSION = "2026-11-22";

export const ORGANIZER_SHEET_TITLE = "You're organizing this, not Strive.";
export const ORGANIZER_SHEET_LINE =
  "Strive doesn't run or supervise games or sessions planned in the app. Pick a public place and tell the players where and when.";
export const PLAYER_SHEET_TITLE = "Organized by players, not by Strive.";
export const PLAYER_SHEET_LINE =
  "Games and sessions in the app are organized by players, not by Strive, and you play at your own risk. Under 18? Tell a parent or guardian where and when you're playing.";

export const PLAY_ACCEPT_KINDS = ["organizer", "player"] as const;
export type PlayAcceptKind = (typeof PLAY_ACCEPT_KINDS)[number];
export function hasAccepted(rows: { kind: string; version: string }[], kind: PlayAcceptKind): boolean {
  return rows.some((r) => r.kind === kind && r.version === PLAY_TERMS_VERSION);
}

// ---- Reporting a session or a game -------------------------------------------------

export const PLAN_REPORT_REASONS = [
  { id: "place", label: "The place is not a public field or park" },
  { id: "inappropriate", label: "Something inappropriate" },
  { id: "bullying", label: "Bullying or someone being unkind" },
  { id: "other", label: "Something else" },
] as const;
export type PlanReportReason = (typeof PLAN_REPORT_REASONS)[number]["id"];
// The one text the coaches get for a reported session or game.
export function planReportText(kind: PlanKind, url: string): string {
  return `A ${kind === "game" ? "game" : "club training session"} in the free app was reported. Look at it here: ${url}`;
}

export function cleanPlanReason(raw: unknown): PlanReportReason | null {
  return PLAN_REPORT_REASONS.some((r) => r.id === raw) ? (raw as PlanReportReason) : null;
}

// ---- Strive events -----------------------------------------------------------

export type StriveEvent = {
  id: string;
  name: string;
  starts_at: string; // ISO
  venue: string;
  price_text: string;
  roster_max: number;
  max_age: number;
  payment_url: string;
  waiver_url: string | null;
  open: boolean;
};

export const EVENT_NAME_MAX = 60;
export const EVENT_VENUE_MAX = 80;
export const EVENT_PRICE_MAX = 80;
export const ROSTER_MAX_LIMIT = 30;

// An https address, or null. Nothing else becomes a link.
export function cleanHttps(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 300 || /\s/.test(s)) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

function line(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s && s.length <= max ? s : null;
}

export type EventInput = {
  name?: unknown;
  startsAt?: unknown; // ISO with an offset
  venue?: unknown;
  price?: unknown;
  rosterMax?: unknown;
  maxAge?: unknown;
  paymentUrl?: unknown;
  waiverUrl?: unknown;
};

export type EventFields = Omit<StriveEvent, "id" | "open">;

// A coach's event, checked field by field. The first problem is named.
export function cleanEvent(input: EventInput): { ok: true; fields: EventFields } | { ok: false; error: string } {
  const name = line(input.name, EVENT_NAME_MAX);
  if (!name) return { ok: false, error: `Give the event a name of up to ${EVENT_NAME_MAX} letters.` };
  const when = typeof input.startsAt === "string" ? new Date(input.startsAt) : null;
  if (!when || Number.isNaN(when.getTime())) return { ok: false, error: "Pick the day and time it starts." };
  const venue = line(input.venue, EVENT_VENUE_MAX);
  if (!venue) return { ok: false, error: `Name the venue in up to ${EVENT_VENUE_MAX} letters.` };
  const price = line(input.price, EVENT_PRICE_MAX);
  if (!price) return { ok: false, error: `Write the entry price in up to ${EVENT_PRICE_MAX} letters.` };
  const rosterMax = Number(input.rosterMax);
  if (!Number.isInteger(rosterMax) || rosterMax < 1 || rosterMax > ROSTER_MAX_LIMIT) {
    return { ok: false, error: `A roster holds 1 to ${ROSTER_MAX_LIMIT} players.` };
  }
  const maxAge = Number(input.maxAge);
  if (!Number.isInteger(maxAge) || maxAge < 8 || maxAge > 99) return { ok: false, error: "Set the oldest age allowed, 8 to 99." };
  const payment = cleanHttps(input.paymentUrl);
  if (!payment) return { ok: false, error: "Paste the payment link. It has to start with https://." };
  const blankWaiver = input.waiverUrl === undefined || input.waiverUrl === null || (typeof input.waiverUrl === "string" && !input.waiverUrl.trim());
  const waiver = blankWaiver ? null : cleanHttps(input.waiverUrl);
  if (!blankWaiver && !waiver) return { ok: false, error: "The waiver link has to start with https://." };
  return {
    ok: true,
    fields: {
      name,
      starts_at: when.toISOString(),
      venue,
      price_text: price,
      roster_max: rosterMax,
      max_age: maxAge,
      payment_url: payment,
      waiver_url: waiver,
    },
  };
}

export const WAIVER_REQUIRED_MESSAGE = "Add the waiver link before opening entries. Every player accepts it before tapping I'm in.";

// May a coach open this event for entries? It needs its waiver link, and
// it must not have started.
export function openProblem(e: Pick<StriveEvent, "waiver_url" | "payment_url" | "starts_at">, nowMs: number): string | null {
  if (!e.waiver_url) return WAIVER_REQUIRED_MESSAGE;
  if (!cleanHttps(e.payment_url)) return "Add the payment link before opening entries.";
  if (new Date(e.starts_at).getTime() <= nowMs) return "That event has already started.";
  return null;
}

// Entries are open while the coaches say so and the event has not started.
export function takingEntries(e: Pick<StriveEvent, "open" | "waiver_url" | "starts_at">, nowMs: number): boolean {
  return e.open && Boolean(e.waiver_url) && new Date(e.starts_at).getTime() > nowMs;
}

// The New York day an event is on ("2026-12-19").
export function eventDay(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function eventWhen(startsAt: string): string {
  return new Date(startsAt).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The oldest a player could be on a day, from the month and year we hold:
// the birthday counted on the 1st of its month. An age limit is checked
// against this, so nobody over it gets in on the benefit of the doubt.
export function oldestAgeOn(birth: Birth, day: string): number {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  return year - birth.year - (month >= birth.month ? 0 : 1);
}

// Under 18 on the event's day, counted the other way (the youngest they
// could be), so the parent line shows whenever there is a doubt.
export function under18On(birth: Birth | null, day: string): boolean {
  return birth === null || ageFromBirth(birth, day) < 18;
}

export const WAIVER_MINOR_LINE = "A parent or guardian should review the waiver with you.";

export type RosterMember = { id: string; birth: Birth | null };

export type RosterProblem =
  | { kind: "empty" }
  | { kind: "too_many"; max: number }
  | { kind: "not_member" }
  | { kind: "no_birth"; id: string }
  | { kind: "too_old"; id: string; max: number }
  | { kind: "taken"; id: string };

// The roster a captain sends: at least one player, no more than the event
// allows, every one on the club, every one at or under the age limit on the
// event's day (checked from the birth month and year the free app holds;
// an unknown birth is not let through), and nobody already on another
// club's roster for this event.
export function rosterProblem(input: {
  picked: string[];
  members: RosterMember[];
  event: Pick<StriveEvent, "roster_max" | "max_age" | "starts_at">;
  onOtherRosters: ReadonlySet<string>;
}): RosterProblem | null {
  const picked = [...new Set(input.picked)];
  if (picked.length === 0) return { kind: "empty" };
  if (picked.length > input.event.roster_max) return { kind: "too_many", max: input.event.roster_max };
  const byId = new Map(input.members.map((m) => [m.id, m]));
  const day = eventDay(input.event.starts_at);
  for (const id of picked) {
    const m = byId.get(id);
    if (!m) return { kind: "not_member" };
    if (input.onOtherRosters.has(id)) return { kind: "taken", id };
    if (!m.birth) return { kind: "no_birth", id };
    if (oldestAgeOn(m.birth, day) > input.event.max_age) return { kind: "too_old", id, max: input.event.max_age };
  }
  return null;
}

// Why one member cannot be picked, in a word the picker shows, or null.
export function memberBlocked(
  m: RosterMember,
  event: Pick<StriveEvent, "max_age" | "starts_at">,
  onOtherRosters: ReadonlySet<string>
): string | null {
  if (onOtherRosters.has(m.id)) return "On another roster";
  if (!m.birth) return "No birth date on file";
  if (oldestAgeOn(m.birth, eventDay(event.starts_at)) > event.max_age) return `Over ${event.max_age}`;
  return null;
}

export function rosterProblemText(p: RosterProblem, nameOf: (id: string) => string): string {
  switch (p.kind) {
    case "empty":
      return "Pick at least one player.";
    case "too_many":
      return `A roster holds ${p.max} players at most.`;
    case "not_member":
      return "Pick players from your club.";
    case "no_birth":
      return `${nameOf(p.id)} has no birth date on file, so we cannot check the age limit.`;
    case "too_old":
      return `${nameOf(p.id)} is over the age limit (${p.max} and under).`;
    case "taken":
      return `${nameOf(p.id)} is already on another club's roster for this event.`;
  }
}

export type EntryState = "waiting" | "sent" | "paid";

// Where an entry stands: waiting on players to say they're in, sent to the
// coaches for payment, or paid (the only state that holds a spot).
export function entryState(input: { roster: { in_at: string | null }[]; sent_at: string | null; paid_at: string | null }): EntryState {
  if (input.paid_at) return "paid";
  if (input.sent_at || (input.roster.length > 0 && input.roster.every((r) => r.in_at))) return "sent";
  return "waiting";
}

// The line on an entered event's card. Nothing says a spot is held before
// it is paid.
export function entryLine(state: EntryState, waiting: number): string {
  if (state === "paid") return "Spot locked.";
  if (state === "sent") return "Entered. Pay to lock your spot.";
  return waiting === 1 ? "Waiting on 1 player to tap I'm in." : `Waiting on ${waiting} players to tap I'm in.`;
}

export function rosterAskLine(club: string, event: string): string {
  return `${club} put you on the roster for ${event}. Are you in?`;
}

// ---- Trained together ----------------------------------------------------------

// A player tags club teammates who trained with them, on the post about
// it. Each one gets a one-tap card; Add puts the same time, kind and day in
// their own week. Never a place.
export const TOGETHER_MAX = 8;
export const TOGETHER_DAYS = 7; // a card waits this long, the feed's own window

// The teammates a post may tag: clubmates only, never the poster, never
// across a block, each once, at most eight. Anything else is dropped, so a
// form can never tag a stranger.
export function cleanTags(input: { raw: unknown; posterId: string; teammates: ReadonlySet<string>; blocks: Block[] }): string[] {
  const list = Array.isArray(input.raw)
    ? input.raw
    : typeof input.raw === "string"
      ? input.raw.split(",")
      : [];
  const out: string[] = [];
  for (const v of list) {
    const id = typeof v === "string" ? v.trim() : "";
    if (!id || id === input.posterId || out.includes(id)) continue;
    if (!input.teammates.has(id)) continue;
    if (blockedEitherWay(input.blocks, input.posterId, id)) continue;
    out.push(id);
    if (out.length === TOGETHER_MAX) break;
  }
  return out;
}

export function togetherAskLine(poster: string, minutes: number, kind: Kind): string {
  const first = firstNameOf(poster);
  return kind === "gym"
    ? `${first} says you were in the gym together, ${fmtDuration(minutes)}. Add it to your week?`
    : `${first} says you trained together, ${fmtDuration(minutes)}. Add it to your week?`;
}

// "with Diego, Nico", "with you and Nico", "with Diego, Nico and 2 more".
export function withLine(names: string[], others = 0): string | null {
  const shown = names.slice(0, 3);
  const more = others + Math.max(0, names.length - shown.length);
  if (shown.length === 0 && more === 0) return null;
  if (shown.length === 0) return `with ${more} ${more === 1 ? "teammate" : "teammates"}`;
  return `with ${shown.join(", ")}${more ? ` and ${more} more` : ""}`;
}

// May this teammate's card still add the time? Only an open card, only
// within the window, and only the player it was meant for.
export function mayAddTogether(input: {
  tag: { tagged: string; answer: string | null };
  viewerId: string;
  day: string;
  today: string;
}): boolean {
  if (input.tag.tagged !== input.viewerId || input.tag.answer !== null) return false;
  const ms = Date.parse(`${input.today}T12:00:00Z`) - Date.parse(`${input.day}T12:00:00Z`);
  return ms >= 0 && ms < TOGETHER_DAYS * 86_400_000;
}

// What an action answers when the one-time sheet has not been accepted
// yet: the screen shows the sheet, then asks again.
export const NEEDS_ORGANIZER_OK = "needs_organizer_ok";
export const NEEDS_PLAYER_OK = "needs_player_ok";

export const OPEN_TO_GAMES_LINE =
  "Captains of other clubs in your county see your club's name, record and how many players it has, and can send you a game. Never a player's name.";
