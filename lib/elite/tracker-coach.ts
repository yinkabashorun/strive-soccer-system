// The free training log: the COACH's list of every free account
// (/coach/free). This is the only place that reads across all free
// accounts, and only the coach page imports it. Nothing a player sees
// comes from here: a player's screens read tracker-server.ts, which only
// ever reads that player's own rows and their own friends'.
import { createServiceClient } from "./supabase/server";
import { nyToday } from "./time";
import {
  DEFAULT_TARGETS,
  allTimeMinutes,
  weekOf,
  type Goal,
  type Grade,
  type Kind,
  type Level,
  type TargetRow,
} from "./tracker";
import { TRACKER_COLUMNS, getTargetTable, isFreeSignupOpen, type Tracker } from "./tracker-server";
import { demoLogs } from "./tracker-demo";

export type FreeAccount = {
  profile_id: string;
  name: string;
  phone: string | null;
  grade: Grade | null;
  level: Level | null;
  goal: Goal | null;
  week_minutes: number; // training this week
  gym_week_minutes: number; // gym this week, apart
  all_minutes: number; // training, all time
  joined: string;
  referrals: number; // joined with this player's link
  friends: number;
};

export type FreeOverview = {
  open: boolean;
  targets: TargetRow[];
  accounts: FreeAccount[];
  week_minutes: number; // training, every account, this week
};

export function demoOverview(today: string): FreeOverview {
  const logs = demoLogs(today);
  const { monday } = weekOf(today);
  const thisWeek = logs.filter((l) => l.trained_on >= monday);
  const week = thisWeek.reduce((n, l) => (l.kind === "training" ? n + l.minutes : n), 0);
  const gym = thisWeek.reduce((n, l) => (l.kind === "gym" ? n + l.minutes : n), 0);
  return {
    open: false,
    targets: DEFAULT_TARGETS,
    week_minutes: week,
    accounts: [
      {
        profile_id: "demo-free-1",
        name: "Example Player",
        phone: null,
        grade: "high_school",
        level: "elite",
        goal: "college",
        week_minutes: week,
        gym_week_minutes: gym,
        all_minutes: allTimeMinutes(logs),
        joined: "2026-11-02T15:00:00.000Z",
        referrals: 1,
        friends: 4,
      },
    ],
  };
}

// Every free account, newest first, with this week's and all-time minutes.
// Caller must already have checked the viewer is a coach.
export async function getFreeOverview(): Promise<FreeOverview> {
  const today = nyToday();
  const admin = createServiceClient();
  if (!admin) return demoOverview(today);

  // The database hands back at most 1,000 rows a request, so each list is
  // read a page at a time until a short page says that is all.
  const PAGE = 1000;
  async function everyRow<T>(
    page: (from: number, to: number) => PromiseLike<{ data: unknown }>
  ): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data } = await page(from, from + PAGE - 1);
      const batch = (data as T[] | null) ?? [];
      out.push(...batch);
      if (batch.length < PAGE) return out;
    }
  }
  type LogRow = { profile_id: string; trained_on: string; minutes: number; kind: Kind };
  type PairRow = { a: string; b: string };
  const [rows, logs, pairs, open, targets] = await Promise.all([
    everyRow<Tracker>((from, to) =>
      admin
        .from("elite_trackers")
        .select(TRACKER_COLUMNS)
        .order("created_at", { ascending: false })
        .order("profile_id")
        .range(from, to)
    ),
    everyRow<LogRow>((from, to) =>
      admin
        .from("elite_training_logs")
        .select("profile_id, trained_on, minutes, kind")
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    everyRow<PairRow>((from, to) =>
      admin.from("elite_tracker_friends").select("a, b").order("a").order("b").range(from, to)
    ),
    isFreeSignupOpen(),
    getTargetTable(),
  ]);
  const ids = rows.map((r) => r.profile_id);
  // Names, a few hundred ids at a time (an id list rides in the address).
  const nameOf = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: profiles } = await admin
      .from("elite_profiles")
      .select("id, full_name")
      .in("id", ids.slice(i, i + 200));
    for (const p of profiles ?? []) nameOf.set(p.id as string, (p.full_name as string) ?? "");
  }
  const { monday, sunday } = weekOf(today);
  const weekBy = new Map<string, number>();
  const gymBy = new Map<string, number>();
  const allBy = new Map<string, number>();
  const add = (m: Map<string, number>, id: string, n: number) => m.set(id, (m.get(id) ?? 0) + n);
  for (const l of logs) {
    const thisWeek = l.trained_on >= monday && l.trained_on <= sunday;
    if (l.kind === "gym") {
      if (thisWeek) add(gymBy, l.profile_id, l.minutes);
      continue;
    }
    add(allBy, l.profile_id, l.minutes);
    if (thisWeek) add(weekBy, l.profile_id, l.minutes);
  }
  const referralsBy = new Map<string, number>();
  for (const r of rows) if (r.referred_by) add(referralsBy, r.referred_by, 1);
  const friendsBy = new Map<string, number>();
  for (const p of pairs) {
    add(friendsBy, p.a, 1);
    add(friendsBy, p.b, 1);
  }

  const accounts = rows.map((r) => ({
    profile_id: r.profile_id,
    name: nameOf.get(r.profile_id) ?? "",
    phone: r.phone,
    grade: r.grade,
    level: r.level,
    goal: r.goal,
    week_minutes: weekBy.get(r.profile_id) ?? 0,
    gym_week_minutes: gymBy.get(r.profile_id) ?? 0,
    all_minutes: allBy.get(r.profile_id) ?? 0,
    joined: r.created_at,
    referrals: referralsBy.get(r.profile_id) ?? 0,
    friends: friendsBy.get(r.profile_id) ?? 0,
  }));
  return {
    open,
    targets,
    accounts,
    week_minutes: accounts.reduce((s, a) => s + a.week_minutes, 0),
  };
}
