// The free training log: reading it (migration 069). Every read uses the
// service client AFTER the caller has established who is signed in; the
// tables also carry owner-read and coach-read RLS as a second lock.
//
// With no database configured (a local build), the example data below
// stands in so the screens can be seen. Nothing is saved in that mode.
import { createServiceClient, isSupabaseConfigured } from "./supabase/server";
import type { Viewer } from "./session";
import { nyToday, shiftDay } from "./time";
import {
  DEFAULT_TARGETS,
  allTimeMinutes,
  homeFor,
  weekOf,
  type Goal,
  type Kind,
  type Level,
  type Season,
  type TargetRow,
  type TrainingLog,
} from "./tracker";

export type Tracker = {
  profile_id: string;
  phone: string | null;
  level: Level | null;
  season: Season | null;
  goal: Goal | null;
  target_minutes: number | null;
  quiz_done_at: string | null;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
};

const TRACKER_COLUMNS =
  "profile_id, phone, level, season, goal, target_minutes, quiz_done_at, referral_code, referred_by, created_at";

// ---- The example account (no database) --------------------------------

export function demoTracker(profileId: string): Tracker {
  return {
    profile_id: profileId,
    phone: null,
    level: "high_school",
    season: "in_season",
    goal: "college",
    target_minutes: 240,
    quiz_done_at: "2026-11-02T15:00:00.000Z",
    referral_code: "STRV2EXM",
    referred_by: null,
    created_at: "2026-11-02T15:00:00.000Z",
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

// ---- One account ------------------------------------------------------

export async function getTracker(profileId: string): Promise<Tracker | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  const { data } = await admin
    .from("elite_trackers")
    .select(TRACKER_COLUMNS)
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data as Tracker | null) ?? null;
}

export async function hasTracker(profileId: string): Promise<boolean> {
  return (await getTracker(profileId)) !== null;
}

// This week's entries (Monday to Sunday, New York), newest first. The
// player's screens only ever show the week.
export async function getWeekLogs(profileId: string, today: string): Promise<TrainingLog[]> {
  const admin = createServiceClient();
  if (!admin) return [];
  const { monday, sunday } = weekOf(today);
  const { data } = await admin
    .from("elite_training_logs")
    .select("id, trained_on, minutes, kind, created_at")
    .eq("profile_id", profileId)
    .gte("trained_on", monday)
    .lte("trained_on", sunday)
    .order("trained_on", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as TrainingLog[] | null) ?? [];
}

export async function getTargetTable(): Promise<TargetRow[]> {
  const admin = createServiceClient();
  if (!admin) return DEFAULT_TARGETS;
  const { data } = await admin.from("elite_target_table").select("season, minutes, minutes_max");
  const rows = (data as TargetRow[] | null) ?? [];
  return rows.length ? rows : DEFAULT_TARGETS;
}

export async function referralCount(profileId: string): Promise<number> {
  const admin = createServiceClient();
  if (!admin) return 0;
  const { count } = await admin
    .from("elite_trackers")
    .select("profile_id", { count: "exact", head: true })
    .eq("referred_by", profileId);
  return count ?? 0;
}

// Is anyone allowed to make a free account right now? Closed unless a
// coach opened it, and closed whenever the switch cannot be read.
export async function isFreeSignupOpen(): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) return false;
  const { data, error } = await admin
    .from("elite_settings")
    .select("value")
    .eq("key", "free_signup_open")
    .maybeSingle();
  if (error || !data) return false;
  return data.value === true;
}

// ---- Who is looking ---------------------------------------------------

// Where this signed-in person belongs (lib/elite/tracker.ts homeFor).
export async function homePathFor(viewer: Viewer): Promise<string> {
  const hasPlayer = Boolean(viewer.playerId);
  const needsLookup = viewer.role === "player" && !hasPlayer && !viewer.demo;
  return homeFor({
    role: viewer.role,
    hasPlayer,
    hasTracker: needsLookup ? await hasTracker(viewer.profile.id) : false,
  });
}

// The free account behind this viewer, or null when they do not have one.
// The example player stands in only when there is no database at all.
export async function trackerFor(viewer: Viewer): Promise<Tracker | null> {
  if (viewer.role !== "player") return null;
  if (viewer.demo) return isSupabaseConfigured() ? null : demoTracker(viewer.profile.id);
  if (viewer.playerId) return null;
  return getTracker(viewer.profile.id);
}

export async function weekLogsFor(viewer: Viewer, today: string): Promise<TrainingLog[]> {
  if (viewer.demo) {
    const { monday } = weekOf(today);
    return demoLogs(today)
      .filter((l) => l.trained_on >= monday)
      .reverse();
  }
  return getWeekLogs(viewer.profile.id, today);
}

// ---- The coach's list -------------------------------------------------

export type FreeAccount = {
  profile_id: string;
  name: string;
  phone: string | null;
  level: Level | null;
  goal: Goal | null;
  week_minutes: number; // training this week
  gym_week_minutes: number; // gym this week, apart
  all_minutes: number; // training, all time
  joined: string;
  referrals: number;
};

export type FreeOverview = {
  open: boolean;
  targets: TargetRow[];
  accounts: FreeAccount[];
  week_minutes: number;
};

export function demoOverview(today: string): FreeOverview {
  const logs = demoLogs(today);
  const { monday } = weekOf(today);
  const thisWeek = logs.filter((l) => l.trained_on >= monday);
  const week = thisWeek.reduce((n, l) => (l.kind === "training" ? n + l.minutes : n), 0);
  const gym = thisWeek.reduce((n, l) => (l.kind === "gym" ? n + l.minutes : n), 0);
  const all = allTimeMinutes(logs);
  return {
    open: false,
    targets: DEFAULT_TARGETS,
    week_minutes: week,
    accounts: [
      {
        profile_id: "demo-free-1",
        name: "Example Player",
        phone: null,
        level: "high_school",
        goal: "college",
        week_minutes: week,
        gym_week_minutes: gym,
        all_minutes: all,
        joined: "2026-11-02T15:00:00.000Z",
        referrals: 1,
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

  // The database hands back at most 1,000 rows a request, so both lists
  // are read a page at a time until a short page says that is all.
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
  const [rows, logs, open, targets] = await Promise.all([
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
  for (const r of rows) {
    if (r.referred_by) referralsBy.set(r.referred_by, (referralsBy.get(r.referred_by) ?? 0) + 1);
  }

  const accounts = rows.map((r) => ({
    profile_id: r.profile_id,
    name: nameOf.get(r.profile_id) ?? "",
    phone: r.phone,
    level: r.level,
    goal: r.goal,
    week_minutes: weekBy.get(r.profile_id) ?? 0,
    gym_week_minutes: gymBy.get(r.profile_id) ?? 0,
    all_minutes: allBy.get(r.profile_id) ?? 0,
    joined: r.created_at,
    referrals: referralsBy.get(r.profile_id) ?? 0,
  }));
  return {
    open,
    targets,
    accounts,
    week_minutes: accounts.reduce((s, a) => s + a.week_minutes, 0),
  };
}
