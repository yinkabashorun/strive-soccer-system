// The free app's example account: what the screens show when there is no
// database at all (a local build). Nothing here is ever served to a real
// account, and nothing is saved anywhere but a cookie in the visitor's
// own browser, so the example reflects what they just did (the quiz they
// took, the days they picked, what they posted today, a friend they
// added, took off or blocked, a post they reported).
//
// The example photos are the mock-up's own (marketing/free-log/mock),
// served from public/free-demo.
import { cookies } from "next/headers";
import { shiftDay } from "./time";
import {
  cleanPlanDays,
  cleanTarget,
  shortName,
  validateQuiz,
  weekOf,
  type BoardEntry,
  type MyClub,
  type Kind,
  type PostRow,
  type QuizAnswers,
  type TrainingLog,
} from "./tracker";
import type { Tracker } from "./tracker-server";

export const DEMO_LOG_COOKIE = "strive_demo_log";

// Something the example player logged today, with or without a photo.
export type DemoEntry = { id: string; day: string; minutes: number; kind: Kind; caption: string | null; photo: boolean; at: string };

export type DemoState = {
  quiz?: QuizAnswers & { target: number };
  days?: number[];
  removed?: string[]; // example friends taken off
  blocked?: string[]; // example friends blocked
  added?: boolean; // the example teammate was added from their link
  today?: DemoEntry[]; // what was logged or posted (kept for the day)
  reported?: string[]; // example posts reported, so hidden
  props?: string[]; // example posts given props
  clubs?: DemoClub[]; // the example player's clubs, once they change them
};

export type DemoClub = { id: string; name: string; code: string; captain: boolean; kind: "player" | "coach" };

export function readDemoState(): DemoState {
  try {
    const raw = cookies().get(DEMO_LOG_COOKIE)?.value;
    return raw ? (JSON.parse(raw) as DemoState) : {};
  } catch {
    return {};
  }
}

// Only ever called from a server action or a route handler (a page
// cannot set a cookie).
export function writeDemoState(patch: DemoState): void {
  cookies().set(DEMO_LOG_COOKIE, JSON.stringify({ ...readDemoState(), ...patch }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export function demoTracker(profileId: string): Tracker {
  const base: Tracker = {
    profile_id: profileId,
    phone: null,
    birth_year: 2010,
    birth_month: 3,
    grade: "high_school",
    level: "elite",
    season: "in_season",
    goal: "college",
    target_minutes: 240,
    plan_days: [0, 1, 2, 4, 5],
    quiz_done_at: "2026-11-02T15:00:00.000Z",
    referral_code: "STRV2EXM",
    referred_by: null,
    playing_for: "NVA 2010 Boys ECNL",
    starred_at: null,
    created_at: "2026-11-02T15:00:00.000Z",
  };
  const state = readDemoState();
  const answers = state.quiz ? validateQuiz(state.quiz) : null;
  const target = state.quiz ? cleanTarget(state.quiz.target) : null;
  const days = cleanPlanDays(state.days);
  return {
    ...base,
    ...(answers && target !== null ? { ...answers, target_minutes: target } : {}),
    ...(days ? { plan_days: days } : {}),
  };
}

// What the example player did today, as the cookie holds it.
export function demoToday(today: string): DemoEntry[] {
  return (readDemoState().today ?? []).filter((e) => e.day === today);
}

export function demoLogs(today: string): TrainingLog[] {
  const { monday } = weekOf(today);
  const rows: [number, number, Kind][] = [
    [0, 60, "training"],
    [1, 45, "training"],
    [1, 45, "gym"],
    [2, 30, "training"],
    [-5, 60, "training"],
    [-3, 45, "gym"],
    [-2, 90, "training"],
  ];
  const earlier = rows
    .map(([offset, minutes, kind], i) => ({
      id: `demo-log-${i}`,
      trained_on: shiftDay(monday, offset),
      minutes,
      kind,
    }))
    .filter((l) => l.trained_on < today);
  const now = demoToday(today).map((e) => ({
    id: e.id,
    trained_on: e.day,
    minutes: e.minutes,
    kind: e.kind,
    photo: e.photo,
  }));
  return [...earlier, ...now];
}

// Five example friends: three trained today, two have not yet.
const DEMO_FRIENDS: BoardEntry[] = [
  { id: "demo-friend-1", name: "Gary Grigoryan", minutes: 270 },
  { id: "demo-friend-2", name: "Yinka Bashorun", minutes: 165 },
  { id: "demo-friend-3", name: "Dani Ramos", minutes: 75 },
  { id: "demo-friend-4", name: "Leo King", minutes: 0 },
  { id: "demo-friend-5", name: "Jalen Tate", minutes: 0 },
];
// The teammate whose link the example player can open.
export const DEMO_ASK = { code: "TEAMMATE", id: "demo-friend-6", name: "Jordan Kim", minutes: 90 };

export function demoFriends(): BoardEntry[] {
  const state = readDemoState();
  const gone = new Set([...(state.removed ?? []), ...(state.blocked ?? [])]);
  const all = state.added ? [...DEMO_FRIENDS, DEMO_ASK] : DEMO_FRIENDS;
  return all
    .filter((f) => !gone.has(f.id))
    .map((f) => ({ id: f.id, name: shortName(f.name), minutes: f.minutes }));
}

export function demoFriendAsk(code: string): { code: string; name: string } | null {
  const state = readDemoState();
  if (code !== DEMO_ASK.code || state.added || (state.blocked ?? []).includes(DEMO_ASK.id)) return null;
  return { code, name: shortName(DEMO_ASK.name) };
}

// ---- Clubs

// The example player starts in two clubs: the coach-made 5v5 one and one
// they captain. The club whose link the example player can open is a third.
const DEMO_CLUB_MEMBERS: Record<string, string[]> = {
  "demo-club-1": ["Gary Grigoryan", "Yinka Bashorun", "Dani Ramos", "Leo King"],
  "demo-club-2": ["Dani Ramos", "Jalen Tate"],
  "demo-club-3": ["Gary Grigoryan", "Sam Okafor"],
};
const DEMO_CLUBS_START: DemoClub[] = [
  { id: "demo-club-1", name: "Strive Elite 5v5: Team 7", code: "STRVTEAM", captain: false, kind: "coach" },
  { id: "demo-club-2", name: "Bull Run 2010s", code: "BULLRUNX", captain: true, kind: "player" },
];
export const DEMO_CLUB_ASK: DemoClub = { id: "demo-club-3", name: "Saturday Pickup", code: "STRVCLUB", captain: false, kind: "player" };

export function demoClubs(): DemoClub[] {
  return readDemoState().clubs ?? DEMO_CLUBS_START;
}

export function demoMyClubs(me: { id: string; name: string }): MyClub[] {
  return demoClubs().map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    kind: c.kind,
    captain: c.captain,
    ended: false,
    members: [
      { id: me.id, name: me.name, captain: c.captain, you: true },
      ...(DEMO_CLUB_MEMBERS[c.id] ?? []).map((n, i) => ({
        id: `${c.id}-m${i}`,
        name: shortName(n),
        captain: false,
        you: false,
      })),
    ],
  }));
}

export function demoClubAsk(code: string): DemoClub | null {
  return code === DEMO_CLUB_ASK.code && !demoClubs().some((c) => c.id === DEMO_CLUB_ASK.id) ? DEMO_CLUB_ASK : null;
}

// The example friends' clubs, for their profiles.
export function demoClubsOf(friendName: string): string[] {
  const full = [...DEMO_FRIENDS, DEMO_ASK].find((f) => shortName(f.name) === friendName)?.name;
  if (!full) return [];
  const all = [...DEMO_CLUBS_START, DEMO_CLUB_ASK];
  return all.filter((c) => (DEMO_CLUB_MEMBERS[c.id] ?? []).includes(full)).map((c) => c.name);
}

// What the example friends' profiles carry beyond the board: aura points
// (shown only as a level), the level they play at from their quiz, their line,
// and whether a coach starred them.
const DEMO_PROFILE: Record<string, { points: number; level: string; playingFor: string | null; starred: boolean }> = {
  "Gary G.": { points: 4620, level: "elite", playingFor: "Armenia U19, Fortuna Koln", starred: true },
  "Yinka B.": { points: 3150, level: "college", playingFor: null, starred: false },
  "Dani R.": { points: 640, level: "travel", playingFor: "Bull Run 2010s", starred: false },
};

export function demoAuraOf(name: string): { points: number; level: string | null; playingFor: string | null; starred: boolean } {
  return DEMO_PROFILE[name] ?? { points: 120, level: null, playingFor: null, starred: false };
}

// The example players this visitor blocked, for the Account page.
export function demoBlocked(): { id: string; name: string }[] {
  const blocked = new Set(readDemoState().blocked ?? []);
  return [...DEMO_FRIENDS, DEMO_ASK]
    .filter((f) => blocked.has(f.id))
    .map((f) => ({ id: f.id, name: shortName(f.name) }));
}

const PHOTO = (name: string) => `/free-demo/${name}`;

// Every example entry of the last few days: the friends' and the example
// player's own. Read by the same feed rules as a real account's.
export function demoPostRows(meId: string, today: string, nowMs: number): PostRow[] {
  const ago = (minutes: number) => new Date(nowMs - minutes * 60_000).toISOString();
  const friends: PostRow[] = [
    {
      id: "demo-post-1",
      profile_id: "demo-friend-1",
      trained_on: today,
      minutes: 75,
      kind: "training",
      created_at: ago(42),
      photo_path: PHOTO("post-gary-1.jpg"),
      caption: "Juggling. Thighs only.",
      removed_at: null,
    },
    {
      id: "demo-post-2",
      profile_id: "demo-friend-2",
      trained_on: today,
      minutes: 45,
      kind: "training",
      created_at: ago(125),
      photo_path: PHOTO("post-yinka-1.jpg"),
      caption: null,
      removed_at: null,
    },
    {
      // logged with no photo: counts for today, shows no card
      id: "demo-post-3",
      profile_id: "demo-friend-3",
      trained_on: today,
      minutes: 30,
      kind: "training",
      created_at: ago(200),
      photo_path: null,
      caption: null,
      removed_at: null,
    },
    {
      id: "demo-post-4",
      profile_id: "demo-friend-1",
      trained_on: shiftDay(today, -1),
      minutes: 60,
      kind: "training",
      created_at: ago(60 * 26),
      photo_path: PHOTO("post-gary-3.jpg"),
      caption: "Weak foot, pop and juggle",
      removed_at: null,
    },
    {
      id: "demo-post-5",
      profile_id: "demo-friend-3",
      trained_on: shiftDay(today, -2),
      minutes: 45,
      kind: "training",
      created_at: ago(60 * 50),
      photo_path: PHOTO("post-gary-2.jpg"),
      caption: "Sprints before school",
      removed_at: null,
    },
  ];
  const mine: PostRow[] = demoToday(today).map((e) => ({
    id: e.id,
    profile_id: meId,
    trained_on: e.day,
    minutes: e.minutes,
    kind: e.kind,
    created_at: e.at,
    photo_path: e.photo ? PHOTO("cam.jpg") : null,
    caption: e.caption,
    removed_at: null,
  }));
  return [...friends, ...mine];
}

// Props on the example posts: a few already there, plus the visitor's.
export function demoProps(): Map<string, { count: number; mine: boolean }> {
  const given = new Set(readDemoState().props ?? []);
  const base: Record<string, number> = { "demo-post-1": 3, "demo-post-2": 2, "demo-post-4": 5, "demo-post-5": 1 };
  const out = new Map<string, { count: number; mine: boolean }>();
  for (const [id, count] of Object.entries(base)) {
    out.set(id, { count: count + (given.has(id) ? 1 : 0), mine: given.has(id) });
  }
  return out;
}
