// The launch numbers (Nov 26 2026): is a new player in the free app
// getting going, overall and club by club.
//
// The free app launches through teams, and every team is a club in the
// app. A club is its own small network: a player stays when their own
// teammates are in it and posting. So the launch is judged twice:
//
//   EVERY NEW PLAYER, for accounts made in the last 30 days and all time
//     joined         made a free account
//     setUp          has a photo and an @username
//     inClub         is in at least one club
//     threeFriends   has 3 friends or more (club teammates are friends)
//     posted         has a timed training post
//     postedIn48h    the first one came inside 48 hours of joining
//     cameBack       trained again on a later day, inside 7 days of the
//                    first one (only players whose first one is 7 days old)
//     medianHours    the typical time from joining to a first post
//   EVERY CLUB
//     members, trained this week, posted at least once, and activated:
//     5 players in it and 3 who have posted.
//
// A "timed post" is training that counts on the boards: never gym, never
// a length a player simply typed in (onBoards in tracker.ts, the one rule
// every board asks). Every number is counted from rows the app already
// stores, never estimated. This file is the one place they are worked
// out: pure, no database, tested in tests/launch-numbers.test.ts. The
// coach's free page shows them (components/elite/LaunchNumbersCard.tsx).
// What leaves here is counts and club names only: no player is named or
// ranked.
import { daysBetween } from "./breaks";
import { nyDateOf } from "./reminders";
import type { Count } from "./squad-numbers";
import { onBoards, weekOf, type Kind } from "./tracker";
import type { Proof } from "./training-clock";

export type LaunchAccount = {
  id: string;
  joinedAt: string; // the instant the free account was made
  hasPhoto: boolean;
  hasUsername: boolean;
};

export type LaunchLog = {
  profileId: string;
  day: string; // the New York date trained
  at: string; // the instant it was posted (a timed session: when it ended)
  kind: Kind;
  proof: Proof | null;
};

export type LaunchClub = { id: string; name: string; archived: boolean };
export type LaunchMember = { clubId: string; profileId: string };
export type LaunchFriendship = { a: string; b: string };

export type LaunchInput = {
  accounts: LaunchAccount[];
  logs: LaunchLog[];
  clubs: LaunchClub[];
  members: LaunchMember[];
  friendships: LaunchFriendship[];
};

export type LaunchWindow = {
  joined: number;
  setUp: Count;
  inClub: Count;
  threeFriends: Count;
  posted: Count;
  postedIn48h: Count;
  cameBack: Count; // of 0: too early to tell
  medianHours: number | null;
};

export type LaunchClubRow = {
  id: string;
  name: string;
  members: number;
  trainedThisWeek: number;
  posted: number;
  activated: boolean;
};

export type LaunchNumbers = {
  last30: LaunchWindow;
  allTime: LaunchWindow;
  clubs: LaunchClubRow[];
  clubsActivated: Count;
};

export const WINDOW_DAYS = 30; // "new" means made this recently
export const FRIENDS_MARK = 3;
export const FIRST_POST_HOURS = 48;
export const COME_BACK_DAYS = 7;
export const CLUB_MIN_MEMBERS = 5;
export const CLUB_MIN_POSTED = 3;

const HOUR_MS = 3_600_000;
const ms = (iso: string) => new Date(iso).getTime();

// The middle value; an even count takes the lower of the two middles, so
// the figure is always one a real player had.
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

// What one player's counting training says about them.
type Trained = {
  firstAt: number; // the instant of their first timed post
  firstDay: string; // the first New York day they trained
  days: Set<string>; // every New York day they trained
};

function trainedBy(logs: LaunchLog[]): Map<string, Trained> {
  const out = new Map<string, Trained>();
  for (const l of logs) {
    if (!onBoards(l)) continue;
    const at = ms(l.at);
    if (Number.isNaN(at)) continue;
    const t = out.get(l.profileId);
    if (!t) {
      out.set(l.profileId, { firstAt: at, firstDay: l.day, days: new Set([l.day]) });
      continue;
    }
    if (at < t.firstAt) t.firstAt = at;
    if (l.day < t.firstDay) t.firstDay = l.day;
    t.days.add(l.day);
  }
  return out;
}

function windowOf(
  accounts: LaunchAccount[],
  trained: Map<string, Trained>,
  inClub: Set<string>,
  friends: Map<string, number>,
  today: string
): LaunchWindow {
  const of = accounts.length;
  let setUp = 0;
  let club = 0;
  let three = 0;
  let posted = 0;
  let in48 = 0;
  let due = 0; // first training at least 7 days ago
  let back = 0;
  const waits: number[] = [];
  for (const a of accounts) {
    if (a.hasPhoto && a.hasUsername) setUp++;
    if (inClub.has(a.id)) club++;
    if ((friends.get(a.id) ?? 0) >= FRIENDS_MARK) three++;
    const t = trained.get(a.id);
    if (!t) continue;
    posted++;
    const joined = ms(a.joinedAt);
    if (!Number.isNaN(joined)) {
      const hours = Math.max(0, t.firstAt - joined) / HOUR_MS;
      waits.push(hours);
      if (hours <= FIRST_POST_HOURS) in48++;
    }
    if (daysBetween(t.firstDay, today) >= COME_BACK_DAYS) {
      due++;
      const returned = [...t.days].some((d) => d > t.firstDay && daysBetween(t.firstDay, d) <= COME_BACK_DAYS);
      if (returned) back++;
    }
  }
  const typical = median(waits);
  return {
    joined: of,
    setUp: { n: setUp, of },
    inClub: { n: club, of },
    threeFriends: { n: three, of },
    posted: { n: posted, of },
    postedIn48h: { n: in48, of },
    cameBack: { n: back, of: due },
    medianHours: typical === null ? null : Math.round(typical * 10) / 10,
  };
}

export function launchNumbers(input: LaunchInput, now: Date): LaunchNumbers {
  const today = nyDateOf(now.toISOString()) ?? now.toISOString().slice(0, 10);
  const accountIds = new Set(input.accounts.map((a) => a.id));
  const trained = trainedBy(input.logs.filter((l) => accountIds.has(l.profileId)));

  const liveClubs = input.clubs.filter((c) => !c.archived);
  const liveIds = new Set(liveClubs.map((c) => c.id));
  // One player once per club, whatever the rows say.
  const membersOf = new Map<string, Set<string>>();
  for (const m of input.members) {
    if (!liveIds.has(m.clubId) || !accountIds.has(m.profileId)) continue;
    const set = membersOf.get(m.clubId) ?? new Set<string>();
    set.add(m.profileId);
    membersOf.set(m.clubId, set);
  }
  const inClub = new Set<string>();
  for (const set of membersOf.values()) for (const id of set) inClub.add(id);

  // A friendship is one row for the pair; each side gains one friend.
  const friendsOf = new Map<string, Set<string>>();
  const befriend = (x: string, y: string) => {
    const set = friendsOf.get(x) ?? new Set<string>();
    set.add(y);
    friendsOf.set(x, set);
  };
  for (const f of input.friendships) {
    if (f.a === f.b || !accountIds.has(f.a) || !accountIds.has(f.b)) continue;
    befriend(f.a, f.b);
    befriend(f.b, f.a);
  }
  const friends = new Map<string, number>([...friendsOf].map(([id, set]) => [id, set.size]));

  const since = now.getTime() - WINDOW_DAYS * 24 * HOUR_MS;
  const recent = input.accounts.filter((a) => ms(a.joinedAt) >= since);

  const { monday, sunday } = weekOf(today);
  const clubs: LaunchClubRow[] = liveClubs
    .map((c) => {
      const ids = [...(membersOf.get(c.id) ?? [])];
      const posted = ids.filter((id) => trained.has(id)).length;
      const thisWeek = ids.filter((id) => [...(trained.get(id)?.days ?? [])].some((d) => d >= monday && d <= sunday)).length;
      return {
        id: c.id,
        name: c.name,
        members: ids.length,
        trainedThisWeek: thisWeek,
        posted,
        activated: ids.length >= CLUB_MIN_MEMBERS && posted >= CLUB_MIN_POSTED,
      };
    })
    .sort((a, b) => b.members - a.members || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  return {
    last30: windowOf(recent, trained, inClub, friends, today),
    allTime: windowOf(input.accounts, trained, inClub, friends, today),
    clubs,
    clubsActivated: { n: clubs.filter((c) => c.activated).length, of: clubs.length },
  };
}

// "Too early to tell" until somebody's first training is a week old.
export const TOO_EARLY = "Too early to tell";
export function fmtCameBack(c: Count): string {
  return c.of === 0 ? TOO_EARLY : `${c.n} of ${c.of}`;
}

// The typical time from joining to a first post: "Under an hour",
// "5 hours", "3 days". A dash when nobody has posted yet.
export function fmtTypical(hours: number | null): string {
  if (hours === null) return "-";
  if (hours < 1) return "Under an hour";
  if (hours < 48) {
    const h = Math.round(hours);
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  return `${Math.round(hours / 24)} days`;
}

// "3 of 32 clubs activated."
export function activatedLine(c: Count): string {
  if (c.of === 0) return "No clubs yet.";
  return `${c.n} of ${c.of} ${c.of === 1 ? "club" : "clubs"} activated.`;
}

// What activated means, said once under the clubs.
export const ACTIVATED_RULE = "A club counts as activated with 5 players in it and 3 who have posted.";
