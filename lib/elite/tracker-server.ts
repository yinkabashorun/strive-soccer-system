// The free training log: what one player's own screens read, and the one
// write that is not a player's own tap (two accounts becoming friends).
// Migration 069. Every call uses the service client AFTER the caller has
// established who is signed in; the tables also carry owner-read RLS as a
// second lock.
//
// Nothing in this file reads across all players. The only other people a
// player is ever shown are their own friends (friendsWeekFor). The
// coach's list of every free account lives apart, in tracker-coach.ts.
//
// With no database configured (a local build), the example data in
// tracker-demo.ts stands in so the screens can be seen.
import { createServiceClient, isSupabaseConfigured } from "./supabase/server";
import type { Viewer } from "./session";
import {
  DEFAULT_TARGETS,
  friendPair,
  homeFor,
  shortName,
  tracksGym,
  weekOf,
  type BoardEntry,
  type Goal,
  type Grade,
  type Level,
  type Season,
  type TargetRow,
  type TrainingLog,
} from "./tracker";
import { demoFriendAsk, demoFriends, demoLogs, demoTracker } from "./tracker-demo";

export type Tracker = {
  profile_id: string;
  phone: string | null;
  grade: Grade | null;
  level: Level | null;
  season: Season | null;
  goal: Goal | null;
  target_minutes: number | null;
  plan_days: number[];
  quiz_done_at: string | null;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
};

export const TRACKER_COLUMNS =
  "profile_id, phone, grade, level, season, goal, target_minutes, plan_days, quiz_done_at, referral_code, referred_by, created_at";

type Admin = NonNullable<ReturnType<typeof createServiceClient>>;

// ---- One account ------------------------------------------------------

export async function getTracker(profileId: string): Promise<Tracker | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  const { data } = await admin
    .from("elite_trackers")
    .select(TRACKER_COLUMNS)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data) return null;
  const row = data as Tracker;
  return { ...row, plan_days: row.plan_days ?? [] };
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

// The set-up is finished: the four questions are answered, a target is
// set and at least one training day is picked.
export function quizDone(
  tracker: Pick<Tracker, "quiz_done_at" | "target_minutes" | "plan_days">
): boolean {
  return Boolean(tracker.quiz_done_at && tracker.target_minutes && tracker.plan_days.length > 0);
}

// Where this signed-in person belongs (lib/elite/tracker.ts homeFor).
export async function homePathFor(viewer: Viewer): Promise<string> {
  const hasPlayer = Boolean(viewer.playerId);
  const needsLookup = viewer.role === "player" && !hasPlayer && !viewer.demo;
  const tracker = needsLookup ? await getTracker(viewer.profile.id) : null;
  return homeFor({
    role: viewer.role,
    hasPlayer,
    tracker: tracker ? { quizDone: quizDone(tracker) } : null,
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

export async function weekLogsFor(
  viewer: Viewer,
  tracker: Pick<Tracker, "grade">,
  today: string
): Promise<TrainingLog[]> {
  if (viewer.demo) {
    const { monday } = weekOf(today);
    return demoLogs(today)
      .filter((l) => l.trained_on >= monday)
      .filter((l) => l.kind === "training" || tracksGym(tracker.grade))
      .reverse();
  }
  return getWeekLogs(viewer.profile.id, today);
}

// Does this email belong to a free account? Asked by the invite route so
// its "already exists" answer can say what is true.
export async function emailHasFreeAccount(email: string): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin || !email) return false;
  const { data: profile } = await admin
    .from("elite_profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (!profile?.id) return false;
  return (await getTracker(profile.id as string)) !== null;
}

// ---- Friends ----------------------------------------------------------

// The ids of this player's own friends: every pair they are one side of.
async function friendIdsOf(admin: Admin, profileId: string): Promise<string[]> {
  const [left, right] = await Promise.all([
    admin.from("elite_tracker_friends").select("b").eq("a", profileId),
    admin.from("elite_tracker_friends").select("a").eq("b", profileId),
  ]);
  const ids = new Set<string>();
  for (const r of (left.data as { b: string }[] | null) ?? []) ids.add(r.b);
  for (const r of (right.data as { a: string }[] | null) ?? []) ids.add(r.a);
  ids.delete(profileId);
  return [...ids];
}

// This player's friends, each with a first name, a last initial and the
// TRAINING minutes they logged this week (gym never counts). Only ever
// the viewer's own friends: the ids come from their own pairs, and every
// read below is limited to those ids.
export async function friendsWeekFor(viewer: Viewer, today: string): Promise<BoardEntry[]> {
  if (viewer.demo) return demoFriends();
  const admin = createServiceClient();
  if (!admin) return [];
  const ids = await friendIdsOf(admin, viewer.profile.id);
  if (ids.length === 0) return [];

  const { monday, sunday } = weekOf(today);
  const names = new Map<string, string>();
  const minutes = new Map<string, number>();
  // A couple of hundred ids at a time (an id list rides in the address),
  // and each list of entries a page at a time (1,000 rows a request).
  for (let i = 0; i < ids.length; i += 200) {
    const some = ids.slice(i, i + 200);
    const { data: profiles } = await admin.from("elite_profiles").select("id, full_name").in("id", some);
    for (const p of profiles ?? []) names.set(p.id as string, (p.full_name as string) ?? "");
    for (let from = 0; ; from += 1000) {
      const { data } = await admin
        .from("elite_training_logs")
        .select("profile_id, minutes")
        .in("profile_id", some)
        .eq("kind", "training")
        .gte("trained_on", monday)
        .lte("trained_on", sunday)
        .order("id")
        .range(from, from + 999);
      const rows = (data as { profile_id: string; minutes: number }[] | null) ?? [];
      for (const r of rows) minutes.set(r.profile_id, (minutes.get(r.profile_id) ?? 0) + r.minutes);
      if (rows.length < 1000) break;
    }
  }
  return ids.map((id) => ({
    id,
    name: shortName(names.get(id) ?? ""),
    minutes: minutes.get(id) ?? 0,
  }));
}

// The owner of a link's code, when this viewer could add them: a real
// free account, not the viewer, not a friend already. Null otherwise.
// Gives back only what a friend would see of the name.
export async function friendAskFor(
  viewer: Viewer,
  code: string | null
): Promise<{ code: string; name: string } | null> {
  if (!code) return null;
  if (viewer.demo) return demoFriendAsk(code);
  const admin = createServiceClient();
  if (!admin) return null;
  const { data: owner } = await admin
    .from("elite_trackers")
    .select("profile_id")
    .eq("referral_code", code)
    .maybeSingle();
  const ownerId = owner?.profile_id as string | undefined;
  if (!ownerId || ownerId === viewer.profile.id) return null;
  if ((await friendIdsOf(admin, viewer.profile.id)).includes(ownerId)) return null;
  const { data: profile } = await admin
    .from("elite_profiles")
    .select("full_name")
    .eq("id", ownerId)
    .maybeSingle();
  return { code, name: shortName((profile?.full_name as string) ?? "") };
}

// Make two free accounts friends, both ways, as one stored pair. Safe to
// repeat. NOT a server action (this file is not one): it is called only
// by code that has already established both ids for itself, the sign-up
// route (who sent the link) and the confirm action (the signed-in viewer
// and the owner of the code they opened).
export async function makeFriends(x: string, y: string): Promise<boolean> {
  const pair = friendPair(x, y);
  const admin = createServiceClient();
  if (!pair || !admin) return false;
  const { error } = await admin
    .from("elite_tracker_friends")
    .upsert(pair, { onConflict: "a,b", ignoreDuplicates: true });
  return !error;
}
