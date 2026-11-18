// The free training log's example account: what the screens show when
// there is no database at all (a local build). Nothing here is ever
// served to a real account, and nothing is saved anywhere but a cookie in
// the visitor's own browser, so the example reflects what they just did
// (the quiz they took, the days they picked, a friend they added or took
// off).
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
  type QuizAnswers,
  type TrainingLog,
} from "./tracker";
import type { Tracker } from "./tracker-server";

export const DEMO_LOG_COOKIE = "strive_demo_log";

export type DemoState = {
  quiz?: QuizAnswers & { target: number };
  days?: number[];
  removed?: string[]; // example friends taken off the board
  added?: boolean; // the example teammate was added from their link
};

export function readDemoState(): DemoState {
  try {
    const raw = cookies().get(DEMO_LOG_COOKIE)?.value;
    return raw ? (JSON.parse(raw) as DemoState) : {};
  } catch {
    return {};
  }
}

// Only ever called from a server action (a page cannot set a cookie).
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
    grade: "high_school",
    level: "elite",
    season: "in_season",
    goal: "college",
    target_minutes: 240,
    plan_days: [0, 1, 2, 4],
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

export function demoLogs(today: string): TrainingLog[] {
  const { monday } = weekOf(today);
  const rows: [number, number, Kind][] = [
    [0, 45, "training"],
    [1, 30, "training"],
    [1, 45, "gym"],
    [2, 60, "training"],
    [-5, 60, "training"],
    [-3, 45, "gym"],
    [-2, 90, "training"],
  ];
  return rows
    .map(([offset, minutes, kind], i) => ({
      id: `demo-log-${i}`,
      trained_on: shiftDay(monday, offset),
      minutes,
      kind,
    }))
    .filter((l) => l.trained_on <= today);
}

// Four example friends, one of them level with the example player.
const DEMO_FRIENDS: BoardEntry[] = [
  { id: "demo-friend-1", name: "Andre Lewis", minutes: 190 },
  { id: "demo-friend-2", name: "Diego Ramos", minutes: 135 },
  { id: "demo-friend-3", name: "Sam Okafor", minutes: 60 },
  { id: "demo-friend-4", name: "Jalen Tate", minutes: 0 },
];
// The teammate whose link the example player can open.
export const DEMO_ASK = { code: "TEAMMATE", id: "demo-friend-5", name: "Jordan Kim", minutes: 90 };

export function demoFriends(): BoardEntry[] {
  const state = readDemoState();
  const removed = new Set(state.removed ?? []);
  const all = state.added ? [...DEMO_FRIENDS, DEMO_ASK] : DEMO_FRIENDS;
  return all
    .filter((f) => !removed.has(f.id))
    .map((f) => ({ id: f.id, name: shortName(f.name), minutes: f.minutes }));
}

export function demoFriendAsk(code: string): { code: string; name: string } | null {
  if (code !== DEMO_ASK.code || readDemoState().added) return null;
  return { code, name: shortName(DEMO_ASK.name) };
}
