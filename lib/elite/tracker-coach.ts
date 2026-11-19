// The free training log: the COACH's list of every free account
// (/coach/free). This is the only place that reads across all free
// accounts, and only the coach page imports it. Nothing a player sees
// comes from here: a player's screens read tracker-server.ts, which only
// ever reads that player's own rows and their own friends'.
import { createServiceClient } from "./supabase/server";
import { nyToday } from "./time";
import {
  DEFAULT_TARGETS,
  POST_BUCKET,
  POST_URL_SECONDS,
  REPORT_REASONS,
  allTimeMinutes,
  labelOf,
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
  posts_week: number; // photos posted this week that are still up
};

// One reported post, waiting for a coach: the photo, who posted it, and
// every player who reported it with their reason.
export type ReportedPost = {
  log_id: string;
  poster: string;
  day: string;
  minutes: number;
  kind: Kind;
  caption: string | null;
  photoUrl: string | null; // a signed address, good for a few minutes
  reports: { reporter: string; reason: string; at: string }[];
};

export type FreeOverview = {
  open: boolean;
  targets: TargetRow[];
  accounts: FreeAccount[];
  week_minutes: number; // training, every account, this week
  posts_week: number; // photos posted this week, every account
  reports: ReportedPost[]; // open, oldest first
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
    posts_week: 4,
    reports: [
      {
        log_id: "demo-post-5",
        poster: "Dani Ramos",
        day: today,
        minutes: 45,
        kind: "training",
        caption: "Sprints before school",
        photoUrl: "/free-demo/post-gary-2.jpg",
        reports: [{ reporter: "Leo King", reason: "It is not training", at: new Date().toISOString() }],
      },
    ],
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
        friends: 5,
        posts_week: 2,
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
  type LogRow = {
    id: string;
    profile_id: string;
    trained_on: string;
    minutes: number;
    kind: Kind;
    photo_path: string | null;
    caption: string | null;
    removed_at: string | null;
  };
  type PairRow = { a: string; b: string };
  type ReportRow = { log_id: string; reporter_id: string; reason: string; created_at: string };
  const [rows, logs, pairs, openReports, open, targets] = await Promise.all([
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
        .select("id, profile_id, trained_on, minutes, kind, photo_path, caption, removed_at")
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    everyRow<PairRow>((from, to) =>
      admin.from("elite_tracker_friends").select("a, b").order("a").order("b").range(from, to)
    ),
    everyRow<ReportRow>((from, to) =>
      admin
        .from("elite_post_reports")
        .select("log_id, reporter_id, reason, created_at")
        .is("resolved_at", null)
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
  const postsBy = new Map<string, number>();
  const add = (m: Map<string, number>, id: string, n: number) => m.set(id, (m.get(id) ?? 0) + n);
  for (const l of logs) {
    const thisWeek = l.trained_on >= monday && l.trained_on <= sunday;
    if (thisWeek && l.photo_path && !l.removed_at) add(postsBy, l.profile_id, 1);
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
    posts_week: postsBy.get(r.profile_id) ?? 0,
  }));

  // The queue: one item per reported post that is still up, oldest report
  // first, each with a signed address for its photo.
  const logById = new Map(logs.map((l) => [l.id, l]));
  const byPost = new Map<string, ReportRow[]>();
  for (const r of openReports) byPost.set(r.log_id, [...(byPost.get(r.log_id) ?? []), r]);
  const waiting = [...byPost.entries()].filter(([id]) => {
    const l = logById.get(id);
    return l && l.photo_path && !l.removed_at;
  });
  const paths = waiting.map(([id]) => logById.get(id)!.photo_path as string);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await admin.storage.from(POST_BUCKET).createSignedUrls(paths, POST_URL_SECONDS);
    for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl);
  }
  const reports: ReportedPost[] = waiting.map(([id, list]) => {
    const l = logById.get(id)!;
    return {
      log_id: id,
      poster: nameOf.get(l.profile_id) || "No name",
      day: l.trained_on,
      minutes: l.minutes,
      kind: l.kind,
      caption: l.caption,
      photoUrl: signed.get(l.photo_path as string) ?? null,
      reports: list.map((r) => ({
        reporter: nameOf.get(r.reporter_id) || "No name",
        reason: labelOf(REPORT_REASONS, r.reason),
        at: r.created_at,
      })),
    };
  });

  return {
    open,
    targets,
    accounts,
    week_minutes: accounts.reduce((s, a) => s + a.week_minutes, 0),
    posts_week: accounts.reduce((s, a) => s + a.posts_week, 0),
    reports,
  };
}
