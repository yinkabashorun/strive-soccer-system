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
};

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
