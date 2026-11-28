// The free app: what one player's own screens read, and the writes that
// are not a plain server action (two accounts becoming friends, a photo
// being stored). Migration 069. Every call uses the service client AFTER
// the caller has established who is signed in; the tables also carry
// owner-read RLS as a second lock.
//
// Nothing in this file reads across all players. The only other people a
// player is ever shown are their own friends (friendsWeekFor, feedFor).
// The coach's list of every free account lives apart, in tracker-coach.ts.
//
// PHOTOS: the bucket is private and no browser can read it. A photo
// leaves here only as a short-lived signed address, and only for a card
// the feed rule opened for this viewer (lib/elite/tracker.ts buildFeed,
// mayViewPhoto). A locked card is never given an address at all.
//
// With no database configured (a local build), the example data in
// tracker-demo.ts stands in so the screens can be seen.
import { createServiceClient, isSupabaseConfigured } from "./supabase/server";
import { avatarUrlsOf, clearProfilePhoto, usernamesOf } from "./account-profile-server";
import type { Viewer } from "./session";
import { shiftDay } from "./time";
import { seedDay } from "./voice";
import { weekCard, weekCardMoment, weekRecap, type WeekCard, type WeekRecap } from "./week-recap";
import { clubRankingFor } from "./tracker-ranking";
import { withLine } from "./club-teams";
import { NO_APP_VERSION, cleanAppVersion, type AppVersion } from "./app-version";
import { livesInFreeApp } from "./member-gate";
import { keepsFreeApp } from "./one-app";
import {
  CLUB_CAP,
  CLUB_REFUSED,
  DEFAULT_TARGETS,
  POST_BUCKET,
  POST_URL_SECONDS,
  blockedEitherWay,
  buildFeed,
  facesRow,
  feedSince,
  friendPair,
  homeFor,
  postPath,
  postedPhotoToday,
  LEVELS,
  AVATAR_MAX_BYTES,
  avatarPath,
  crestOf,
  firstNameOf,
  mayViewPhoto,
  lastTrainedLabel,
  looksLikeJpeg,
  mayGiveProps,
  ownsAvatarPath,
  ownsPostPath,
  profilePosts,
  auraLevel,
  auraPoints,
  clubJoinDecision,
  clubPairs,
  labelOf,
  initialsOf,
  mayViewProfile,
  newReferralCode,
  shortName,
  timeSince,
  tracksGym,
  weekOf,
  type Block,
  type AuraLog,
  type ClubJoin,
  type ClubKind,
  type MyClub,
  type Profile,
  type BoardEntry,
  type Face,
  type Goal,
  type Grade,
  type Kind,
  type Level,
  type LockedCard,
  type OpenCard,
  type PhotoViewer,
  type PostRow,
  type Season,
  type TargetRow,
  type TrainingLog,
  limitHit,
  onBoards,
  setUpDone,
  CLUB_REQUESTS_PENDING_MAX,
  nextCaptain,
} from "./tracker";
import { TYPED, countsOnBoards, type Proof } from "./training-clock";
import {
  demoBlocked,
  DEMO_CLUB_ASK,
  demoAuraOf,
  demoMyPhoto,
  demoPhotoOf,
  demoClubAsk,
  demoClubsOf,
  demoMyClubs,
  demoFriendAsk,
  demoFriends,
  demoLogs,
  demoPostRows,
  demoProps,
  demoTracker,
  readDemoState,
} from "./tracker-demo";

export type Tracker = {
  profile_id: string;
  phone: string | null;
  birth_year: number | null;
  birth_month: number | null;
  grade: Grade | null;
  level: Level | null;
  season: Season | null;
  goal: Goal | null;
  target_minutes: number | null;
  plan_days: number[];
  quiz_done_at: string | null;
  referral_code: string;
  referred_by: string | null;
  playing_for: string | null;
  starred_at: string | null;
  avatar_path: string | null;
  created_at: string;
};

export const TRACKER_COLUMNS =
  "profile_id, phone, birth_year, birth_month, grade, level, season, goal, target_minutes, plan_days, quiz_done_at, referral_code, referred_by, playing_for, starred_at, avatar_path, created_at";

export type Admin = NonNullable<ReturnType<typeof createServiceClient>>;

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

// A free account made for a Strive Pro member who has none (the rule and
// the caller: lib/elite/one-app.ts getsFreeApp, pro-social-server.ts). The
// row holds their own code to share, the season their member quiz gave
// and the coaches' weekly target for it; nothing else is set. One row per
// person is held by the table's key: when a second read makes it at the
// same moment, the insert is refused and the row that exists is read back.
export async function makeTrackerForMember(profileId: string, season: Season, targetMinutes: number): Promise<Tracker | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  // The code is unique in the database; on the rare clash, draw again.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await admin.from("elite_trackers").insert({
      profile_id: profileId,
      referral_code: newReferralCode(),
      season,
      target_minutes: targetMinutes,
    });
    if (!error) break;
    if (await getTracker(profileId)) break;
  }
  return getTracker(profileId);
}

export async function hasTracker(profileId: string): Promise<boolean> {
  return (await getTracker(profileId)) !== null;
}

// The facts behind the first-days list (lib/elite/first-days.ts): has this
// player ever posted a training photo, how many clubs are they on, have
// they ever given props. Three counts, never the rows. A read that fails
// says "nothing yet", which only leaves a step open.
export async function firstDaysFacts(profileId: string): Promise<{ posted: boolean; clubs: number; gaveProps: boolean }> {
  const admin = createServiceClient();
  if (!admin) return { posted: false, clubs: 0, gaveProps: false };
  const count = { count: "exact" as const, head: true };
  const [posts, clubs, props] = await Promise.all([
    admin.from("elite_training_logs").select("id", count).eq("profile_id", profileId).not("photo_path", "is", null),
    admin.from("elite_tracker_club_members").select("club_id", count).eq("profile_id", profileId),
    admin.from("elite_log_props").select("log_id", count).eq("profile_id", profileId),
  ]);
  return { posted: (posts.count ?? 0) > 0, clubs: clubs.count ?? 0, gaveProps: (props.count ?? 0) > 0 };
}

// This week's entries (Monday to Sunday, New York), newest first. The
// player's screens only ever show the week.
export async function getWeekLogs(profileId: string, today: string): Promise<TrainingLog[]> {
  const admin = createServiceClient();
  if (!admin) return [];
  const { monday, sunday } = weekOf(today);
  const { data } = await admin
    .from("elite_training_logs")
    .select("id, trained_on, minutes, kind, created_at, photo_path, removed_at, proof")
    .eq("profile_id", profileId)
    .gte("trained_on", monday)
    .lte("trained_on", sunday)
    .order("trained_on", { ascending: false })
    .order("created_at", { ascending: false });
  type Row = TrainingLog & { photo_path: string | null; removed_at: string | null; proof: Proof | null };
  return ((data as Row[] | null) ?? []).map(({ photo_path, removed_at, proof, ...l }) => ({
    ...l,
    photo: Boolean(photo_path) && !removed_at,
    timed: countsOnBoards(proof),
  }));
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

// The oldest build of the iPhone app that still works, and the one link to
// the app (lib/elite/app-version.ts). Two rows of the same settings table
// the sign-up switch lives in. Anything that cannot be read answers "every
// build works, no link": this must never lock a player out.
export async function getAppVersion(): Promise<AppVersion> {
  const admin = createServiceClient();
  if (!admin) return NO_APP_VERSION;
  try {
    const { data, error } = await admin.from("elite_settings").select("key, value").in("key", ["app_min_build", "app_link"]);
    if (error || !data) return NO_APP_VERSION;
    const rows = data as { key: string; value: unknown }[];
    const of = (key: string) => rows.find((r) => r.key === key)?.value;
    return cleanAppVersion({ minBuild: of("app_min_build"), link: of("app_link") });
  } catch {
    return NO_APP_VERSION;
  }
}

// ---- Who is looking ---------------------------------------------------

// The set-up is finished: the four questions are answered, a target is
// set and at least one training day is picked.
export function quizDone(
  tracker: Pick<Tracker, "quiz_done_at" | "target_minutes" | "plan_days">
): boolean {
  return setUpDone(tracker);
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
//
// ONE APP (lib/elite/one-app.ts, Nov 24 2026): a free account KEEPS its
// free app when it starts Strive Pro. Friends, posts, clubs and the week
// are the same account's before, during and after a membership; Strive Pro
// only adds the Train tab. So this answers for a free account AND for a
// Strive Pro member who has one behind them (keepsFreeApp). An invite
// family or a member who joined Strive Pro directly has no free account
// and gets null.
export async function trackerFor(viewer: Viewer): Promise<Tracker | null> {
  return (await freeSideOf(viewer))?.tracker ?? null;
}

// Only an account that LIVES in the free app right now: a free account
// with no membership on (never started, never paid, or Strive Pro ended).
// For the few places that must tell a free account from a member: the
// Account page (a member's has Cancel Strive Pro), what a deleted account
// held, and which key a phone is kept on file under.
export async function freeAccountFor(viewer: Viewer): Promise<Tracker | null> {
  const side = await freeSideOf(viewer);
  return side && side.lives ? side.tracker : null;
}

// Both answers in one read: the free account, and whether the person
// lives in it (`lives`) or has Strive Pro on top of it (not `lives`).
export async function freeSideOf(viewer: Viewer): Promise<{ tracker: Tracker; lives: boolean } | null> {
  if (viewer.role !== "player") return null;
  if (viewer.demo) {
    const demo = isSupabaseConfigured() ? null : demoTracker(viewer.profile.id);
    return demo ? { tracker: demo, lives: true } : null;
  }
  const tracker = await getTracker(viewer.profile.id);
  if (!tracker) return null;
  if (!viewer.playerId) return { tracker, lives: true };
  const admin = createServiceClient();
  if (!admin) return null;
  const { data } = await admin
    .from("elite_players")
    .select("tier, subscription_status")
    .eq("id", viewer.playerId)
    .maybeSingle();
  const player = (data as { tier: string | null; subscription_status: string | null } | null) ?? null;
  if (!keepsFreeApp({ hasTracker: true, hasPlayer: true, tier: player?.tier, status: player?.subscription_status })) return null;
  return { tracker, lives: livesInFreeApp({ hasTracker: true, hasPlayer: true, player }) };
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
export async function friendIdsOf(admin: Admin, profileId: string): Promise<string[]> {
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
        .neq("proof", TYPED) // typed time counts on the player's own week only
        .gte("trained_on", monday)
        .lte("trained_on", sunday)
        .order("id")
        .range(from, from + 999);
      const rows = (data as { profile_id: string; minutes: number }[] | null) ?? [];
      for (const r of rows) minutes.set(r.profile_id, (minutes.get(r.profile_id) ?? 0) + r.minutes);
      if (rows.length < 1000) break;
    }
  }
  const [starred, photos] = await Promise.all([starredAmong(admin, ids), avatarsOf(admin, ids)]);
  return ids.map((id) => ({
    id,
    name: shortName(names.get(id) ?? ""),
    minutes: minutes.get(id) ?? 0,
    starred: starred.has(id),
    photo: photos.get(id) ?? null,
  }));
}

// The Monday moment (week-recap.ts): last week's numbers for the card at
// the top of Week. The player's own counting training per week (the same
// timed-training sum the board uses: auraLogsOf leaves typed time out, and
// only training is added), their gym last week when they track gym, and
// each friend's counting training last week (the board's own reader, for
// last week). Reads only this player and their own friends; sends nothing.
export async function weekRecapFor(viewer: Viewer, tracker: Tracker, today: string): Promise<WeekRecap | null> {
  if (viewer.demo) return null;
  const admin = createServiceClient();
  if (!admin) return null;
  const { monday: thisMonday } = weekOf(today);
  const lastDay = shiftDay(thisMonday, -1); // Sunday of last week
  const { monday: lastMonday } = weekOf(lastDay);
  const [own, lastLogs, friends] = await Promise.all([
    auraLogsOf(admin, viewer.profile.id),
    getWeekLogs(viewer.profile.id, lastDay),
    friendsWeekFor(viewer, lastDay),
  ]);
  const byWeek = new Map<string, number>();
  for (const l of own) {
    if (l.kind !== "training" || l.trained_on >= thisMonday) continue;
    const m = weekOf(l.trained_on).monday;
    byWeek.set(m, (byWeek.get(m) ?? 0) + l.minutes);
  }
  const lastWeek = byWeek.get(lastMonday) ?? 0;
  byWeek.delete(lastMonday);
  const gym = tracksGym(tracker.grade) ? lastLogs.reduce((s, l) => (l.kind === "gym" ? s + l.minutes : s), 0) : 0;
  return weekRecap({
    week: thisMonday,
    lastWeek,
    earlier: [...byWeek.values()],
    gymLastWeek: gym,
    friends: friends.map((f) => f.minutes),
  });
}

// The week's card (week-recap.ts weekCard): Sunday from noon New York,
// this week so far; Monday, last week closed. The same reads as the Monday
// moment above (the board's own timed-training sums), for the week the
// card is about, with each friend's name so the line can name them. Null
// on every other day. Reads only this player and their own friends.
export async function weekCardFor(viewer: Viewer, tracker: Tracker, now: Date = new Date()): Promise<WeekCard | null> {
  if (viewer.demo) return null;
  const moment = weekCardMoment(now);
  if (!moment) return null;
  const admin = createServiceClient();
  if (!admin) return null;
  const today = seedDay(now); // the New York day of `now`
  const { monday: thisMonday } = weekOf(today);
  // a day inside the week the card is about
  const aboutDay = moment === "sunday" ? today : shiftDay(thisMonday, -1);
  const { monday: aboutMonday } = weekOf(aboutDay);
  const [own, logs, friends] = await Promise.all([
    auraLogsOf(admin, viewer.profile.id),
    getWeekLogs(viewer.profile.id, aboutDay),
    friendsWeekFor(viewer, aboutDay),
  ]);
  const byWeek = new Map<string, number>();
  for (const l of own) {
    if (l.kind !== "training" || l.trained_on > aboutDay) continue;
    const m = weekOf(l.trained_on).monday;
    byWeek.set(m, (byWeek.get(m) ?? 0) + l.minutes);
  }
  const mine = byWeek.get(aboutMonday) ?? 0;
  byWeek.delete(aboutMonday);
  const gym = tracksGym(tracker.grade) ? logs.reduce((s, l) => (l.kind === "gym" ? s + l.minutes : s), 0) : 0;
  return weekCard({
    moment,
    week: aboutMonday,
    mine,
    earlier: [...byWeek.values()],
    gym,
    friends: friends.map((f) => ({ name: f.name, minutes: f.minutes })),
  });
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
  if (blockedEitherWay(await blocksBetween(admin, viewer.profile.id, ownerId), viewer.profile.id, ownerId)) return null;
  // a request already on its way is not asked again
  const { data: pending } = await admin
    .from("elite_tracker_friend_requests")
    .select("requester")
    .eq("requester", viewer.profile.id)
    .eq("recipient", ownerId)
    .maybeSingle();
  if (pending) return null;
  const { data: profile } = await admin
    .from("elite_profiles")
    .select("full_name")
    .eq("id", ownerId)
    .maybeSingle();
  return { code, name: shortName((profile?.full_name as string) ?? "") };
}

// Every block between two accounts, in either direction.
async function blocksBetween(admin: Admin, x: string, y: string): Promise<Block[]> {
  const [one, two] = await Promise.all([
    admin.from("elite_tracker_blocks").select("blocker, blocked").eq("blocker", x).eq("blocked", y),
    admin.from("elite_tracker_blocks").select("blocker, blocked").eq("blocker", y).eq("blocked", x),
  ]);
  return [...((one.data as Block[] | null) ?? []), ...((two.data as Block[] | null) ?? [])];
}

// Make two free accounts friends, both ways, as one stored pair. Safe to
// repeat. Refused while either has blocked the other. NOT a server action
// (this file is not one), and since 072 only ever reached through a
// request both sides wanted: answerFriendRequest (the recipient accepted)
// or requestFriend (each had asked the other).
// x is the player who opened the link, y the link's owner. When y once
// took x off, x cannot come straight back on y's link (071); y adding x
// again from x's link clears that.
export async function makeFriends(x: string, y: string): Promise<"ok" | "blocked" | "error"> {
  const pair = friendPair(x, y);
  const admin = createServiceClient();
  if (!pair || !admin) return "error";
  if (blockedEitherWay(await blocksBetween(admin, x, y), x, y)) return "blocked";
  const { data: removed } = await admin
    .from("elite_tracker_unfriends")
    .select("remover")
    .eq("remover", y)
    .eq("removed", x)
    .maybeSingle();
  if (removed) return "blocked";
  await admin.from("elite_tracker_unfriends").delete().eq("remover", x).eq("removed", y);
  const { error } = await admin
    .from("elite_tracker_friends")
    .upsert(pair, { onConflict: "a,b", ignoreDuplicates: true });
  return error ? "error" : "ok";
}

// ---- Friend requests (072) ----------------------------------------------

// Opening a player's link sends them a request; only their Accept makes the
// two friends. "sent" is also what a requester hears when the link's owner
// once took them off (071): the request is quietly not stored, so a removed
// player cannot keep asking, and is never told.
export const FRIEND_REQUESTS_PENDING_MAX = 30;
export type FriendRequestResult = "sent" | "friends" | "already" | "blocked" | "too_many" | "error";

export async function requestFriend(requester: string, recipient: string): Promise<FriendRequestResult> {
  const pair = friendPair(requester, recipient);
  const admin = createServiceClient();
  if (!pair || !admin) return "error";
  if ((await friendIdsOf(admin, requester)).includes(recipient)) return "already";
  if (blockedEitherWay(await blocksBetween(admin, requester, recipient), requester, recipient)) return "blocked";
  const { data: removed } = await admin
    .from("elite_tracker_unfriends")
    .select("remover")
    .eq("remover", recipient)
    .eq("removed", requester)
    .maybeSingle();
  if (removed) return "sent";
  // they already asked us: both want it, so it is a pair now
  const { data: reverse } = await admin
    .from("elite_tracker_friend_requests")
    .select("requester")
    .eq("requester", recipient)
    .eq("recipient", requester)
    .maybeSingle();
  if (reverse) return (await makeFriends(requester, recipient)) === "ok" ? "friends" : "error";
  const { count } = await admin
    .from("elite_tracker_friend_requests")
    .select("requester", { count: "exact", head: true })
    .eq("requester", requester);
  if ((count ?? 0) >= FRIEND_REQUESTS_PENDING_MAX) return "too_many";
  const { error } = await admin
    .from("elite_tracker_friend_requests")
    .upsert({ requester, recipient }, { onConflict: "requester,recipient", ignoreDuplicates: true });
  return error ? "error" : "sent";
}

// What already stands between two players, read BEFORE a request is sent,
// for the wording only (lib/elite/friend-add.ts: adding a friend by their
// exact @username). It decides nothing and stores nothing: requestFriend
// above is still the one place a request is made or refused.
//   removed   the recipient once took the requester off (071): requestFriend
//             answers "sent" and stores nothing
//   waiting   a request from the requester is already waiting on them
// Null when it could not be read.
export async function friendAskFacts(requester: string, recipient: string): Promise<{ removed: boolean; waiting: boolean } | null> {
  const admin = createServiceClient();
  if (!admin || !friendPair(requester, recipient)) return null;
  const [removed, waiting] = await Promise.all([
    admin.from("elite_tracker_unfriends").select("remover").eq("remover", recipient).eq("removed", requester).maybeSingle(),
    admin.from("elite_tracker_friend_requests").select("requester").eq("requester", requester).eq("recipient", recipient).maybeSingle(),
  ]);
  if (removed.error || waiting.error) return null;
  return { removed: Boolean(removed.data), waiting: Boolean(waiting.data) };
}

// The requests waiting on this viewer, newest first: first name and last
// initial only. No photo until they are friends.
export type FriendRequestView = { id: string; name: string; initials: string };

export async function friendRequestsFor(viewer: Viewer): Promise<FriendRequestView[]> {
  if (viewer.demo) return [];
  const admin = createServiceClient();
  if (!admin) return [];
  const { data } = await admin
    .from("elite_tracker_friend_requests")
    .select("requester, created_at")
    .eq("recipient", viewer.profile.id)
    .order("created_at", { ascending: false })
    .limit(FRIEND_REQUESTS_PENDING_MAX);
  const ids = ((data as { requester: string }[] | null) ?? []).map((r) => r.requester);
  if (ids.length === 0) return [];
  const names = await namesOf(admin, ids);
  return ids.map((id) => {
    const name = names.get(id) ?? "A teammate";
    return { id, name, initials: initialsOf(name) };
  });
}

// The viewer's answer to one request waiting on them. Accept makes the
// pair (a block still wins); either answer takes the request away.
export async function answerFriendRequest(
  recipient: string,
  requester: string,
  accept: boolean
): Promise<"ok" | "none" | "blocked" | "error"> {
  const admin = createServiceClient();
  if (!admin || !friendPair(recipient, requester)) return "error";
  const { data: request } = await admin
    .from("elite_tracker_friend_requests")
    .select("requester")
    .eq("requester", requester)
    .eq("recipient", recipient)
    .maybeSingle();
  if (!request) return "none";
  await admin.from("elite_tracker_friend_requests").delete().eq("requester", requester).eq("recipient", recipient);
  if (!accept) return "ok";
  // accepting is choosing them again, so an old take-off by the one
  // accepting no longer stands in the way
  await admin.from("elite_tracker_unfriends").delete().eq("remover", recipient).eq("removed", requester);
  const made = await makeFriends(requester, recipient);
  return made === "ok" ? "ok" : made === "blocked" ? "blocked" : "error";
}

// The players this viewer has blocked, for the Account page, where a
// block can be taken back. Only what a friend would see of each name.
export async function blockedFor(viewer: Viewer): Promise<{ id: string; name: string }[]> {
  if (viewer.demo) return demoBlocked();
  const admin = createServiceClient();
  if (!admin) return [];
  const profileId = viewer.profile.id;
  const { data } = await admin.from("elite_tracker_blocks").select("blocked").eq("blocker", profileId);
  const ids = ((data as { blocked: string }[] | null) ?? []).map((r) => r.blocked);
  if (ids.length === 0) return [];
  const names = await namesOf(admin, ids);
  return ids.map((id) => ({ id, name: names.get(id) ?? "A teammate" }));
}

// ---- The star -----------------------------------------------------------

// Which of these accounts carry the coaches' star.
export async function starredAmong(admin: Admin, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin
      .from("elite_trackers")
      .select("profile_id")
      .in("profile_id", ids.slice(i, i + 200))
      .not("starred_at", "is", null);
    for (const r of (data as { profile_id: string }[] | null) ?? []) out.add(r.profile_id);
  }
  return out;
}

// ---- Profile photos -------------------------------------------------------

// Signed addresses for the profile photos of these accounts. A caller
// passes only ids the viewer may see a photo of (mayViewAvatar: the
// viewer, their friends, and every account for a coach); no id here is
// ever taken from the browser. One photo per account, members and free
// accounts alike: lib/elite/account-profile-server.ts (081).
export async function avatarsOf(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  return avatarUrlsOf(admin, ids);
}

// Take a player's profile photo off: the file and the pointer. Used by a
// coach from the queue. The photo is required (081), so the player is
// asked for a new one the next time they open the app.
export async function clearAvatar(profileId: string): Promise<boolean> {
  return clearProfilePhoto(profileId);
}

// The viewer's own photo, for their own screens.
export async function myPhotoFor(viewer: Viewer): Promise<string | null> {
  if (viewer.demo) return demoMyPhoto();
  const admin = createServiceClient();
  if (!admin) return null;
  return (await avatarsOf(admin, [viewer.profile.id])).get(viewer.profile.id) ?? null;
}

// The viewer's own newest photo post this week, for the little story on
// the share card. Their own photo: no one else's is ever used for it.
export async function myLatestPhotoFor(viewer: Viewer, today: string): Promise<string | null> {
  const { monday } = weekOf(today);
  if (viewer.demo) {
    const mine = demoPostRows(viewer.profile.id, today, Date.now())
      .filter((r) => r.profile_id === viewer.profile.id && r.photo_path && r.trained_on >= monday)
      .sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
    return mine?.photo_path ?? null;
  }
  const admin = createServiceClient();
  if (!admin) return null;
  const { data } = await admin
    .from("elite_training_logs")
    .select("photo_path")
    .eq("profile_id", viewer.profile.id)
    .gte("trained_on", monday)
    .not("photo_path", "is", null)
    .is("removed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const path = (data as { photo_path: string } | null)?.photo_path;
  if (!path || !ownsPostPath(path, viewer.profile.id)) return null;
  return (await signPhotos(admin, [path])).get(path) ?? null;
}

// Blocks either way between the viewer and any of these accounts.
export async function blocksWith(admin: Admin, profileId: string, ids: string[]): Promise<Block[]> {
  const out: Block[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const some = ids.slice(i, i + 200);
    const [mine, theirs] = await Promise.all([
      admin.from("elite_tracker_blocks").select("blocker, blocked").eq("blocker", profileId).in("blocked", some),
      admin.from("elite_tracker_blocks").select("blocker, blocked").eq("blocked", profileId).in("blocker", some),
    ]);
    out.push(...((mine.data as Block[] | null) ?? []), ...((theirs.data as Block[] | null) ?? []));
  }
  return out;
}

// ---- Posts and the feed -----------------------------------------------

const POST_COLUMNS = "id, profile_id, trained_on, minutes, kind, created_at, photo_path, caption, removed_at, proof, start_photo_path";

// First name and last initial for a list of accounts.
export async function namesOf(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("elite_profiles").select("id, full_name").in("id", ids.slice(i, i + 200));
    for (const p of data ?? []) names.set(p.id as string, shortName((p.full_name as string) ?? ""));
  }
  return names;
}

// Every entry these accounts logged between two days, photo or not.
export async function entriesOf(admin: Admin, ids: string[], since: string, until: string): Promise<PostRow[]> {
  const out: PostRow[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const some = ids.slice(i, i + 200);
    for (let from = 0; ; from += 1000) {
      const { data } = await admin
        .from("elite_training_logs")
        .select(POST_COLUMNS)
        .in("profile_id", some)
        .gte("trained_on", since)
        .lte("trained_on", until)
        .order("id")
        .range(from, from + 999);
      const rows = (data as PostRow[] | null) ?? [];
      out.push(...rows);
      if (rows.length < 1000) break;
    }
  }
  return out;
}

// The ids of the posts this viewer reported: gone from their feed.
export async function reportedBy(admin: Admin, profileId: string): Promise<Set<string>> {
  const { data } = await admin.from("elite_post_reports").select("log_id").eq("reporter_id", profileId);
  return new Set(((data as { log_id: string }[] | null) ?? []).map((r) => r.log_id));
}

// Signed addresses for stored photos, good for a few minutes. Asked for
// open cards only; a path that could not be signed is simply left out.
export async function signPhotos(admin: Admin, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data } = await admin.storage.from(POST_BUCKET).createSignedUrls(paths, POST_URL_SECONDS);
  for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  return out;
}

// One card as the screen gets it. An open card carries the photo's
// address; a locked card carries a name and a time and nothing else.
export type OpenCardView = Omit<OpenCard, "photoPath" | "createdAt" | "startPhotoPath"> & {
  photoUrl: string;
  startPhotoUrl?: string | null; // the photo that started the clock, when there is one
  ago: string;
  props: number;
  propped: boolean;
  together?: string | null; // "with Diego, Nico": teammates who added it (077)
};
export type FeedCardView = OpenCardView | LockedCard;
export type FeedView = {
  unlocked: boolean; // the viewer posted a photo today
  faces: Face[];
  friendCount: number;
  friendsToday: number; // friends with anything logged today
  cards: FeedCardView[];
};

// The Friends tab: who trained today, and the last seven days of posts
// from this player's friends and from the player. Only ever the viewer's
// own friends: the ids come from their own pairs.
export async function feedFor(viewer: Viewer, today: string): Promise<FeedView> {
  const me = { id: viewer.profile.id, name: shortName(viewer.profile.full_name) };
  const nowMs = Date.now();
  let friends: { id: string; name: string }[];
  let rows: PostRow[];
  let reported: Set<string>;
  let propsOf: (ids: string[]) => Promise<Map<string, { count: number; mine: boolean }>>;
  let sign: (paths: string[]) => Promise<Map<string, string>>;
  let starred = new Set<string>();
  let photos = new Map<string, string>();

  const admin = viewer.demo ? null : createServiceClient();
  if (!admin) {
    // the example account: the same rules, example rows, photos that are
    // plain files of the example
    const example = demoFriends();
    friends = example;
    starred = new Set(example.filter((f) => f.starred).map((f) => f.id));
    for (const f of example) if (f.photo) photos.set(f.id, f.photo);
    const minePhoto = demoMyPhoto();
    if (minePhoto) photos.set(me.id, minePhoto);
    const mine = new Set(friends.map((f) => f.id));
    rows = demoPostRows(me.id, today, nowMs).filter((r) => r.profile_id === me.id || mine.has(r.profile_id));
    reported = new Set(readDemoState().reported ?? []);
    propsOf = async () => demoProps();
    sign = async (paths) => new Map(paths.map((p) => [p, p]));
  } else {
    const ids = await friendIdsOf(admin, me.id);
    const names = await namesOf(admin, ids);
    friends = ids.map((id) => ({ id, name: names.get(id) ?? "A teammate" }));
    [rows, reported] = await Promise.all([
      entriesOf(admin, [me.id, ...ids], feedSince(today), today),
      reportedBy(admin, me.id),
    ]);
    propsOf = async (logIds) => {
      const out = new Map<string, { count: number; mine: boolean }>();
      for (let i = 0; i < logIds.length; i += 200) {
        const { data } = await admin
          .from("elite_log_props")
          .select("log_id, profile_id")
          .in("log_id", logIds.slice(i, i + 200));
        for (const r of (data as { log_id: string; profile_id: string }[] | null) ?? []) {
          const cur = out.get(r.log_id) ?? { count: 0, mine: false };
          out.set(r.log_id, { count: cur.count + 1, mine: cur.mine || r.profile_id === me.id });
        }
      }
      return out;
    };
    sign = (paths) => signPhotos(admin, paths);
    [starred, photos] = await Promise.all([starredAmong(admin, [me.id, ...ids]), avatarsOf(admin, [me.id, ...ids])]);
  }

  const friendIds = new Set(friends.map((f) => f.id));
  const unlocked = postedPhotoToday(rows, me.id, today);
  const photoViewer: PhotoViewer = { id: me.id, staff: false, friendIds, unlocked, reported };
  const names = new Map<string, string>([[me.id, me.name], ...friends.map((f) => [f.id, f.name] as const)]);
  const cards = buildFeed({ rows, viewer: photoViewer, names, today });

  const open = cards.filter((c): c is OpenCard => c.state === "open");
  const [urls, props, together] = await Promise.all([
    sign(open.flatMap((c) => (c.startPhotoPath ? [c.photoPath, c.startPhotoPath] : [c.photoPath]))),
    propsOf(open.map((c) => c.id)),
    admin ? togetherOf(admin, open.map((c) => c.id)) : Promise.resolve(new Map<string, string[]>()),
  ]);
  // "with Diego, Nico": the teammates who added a post's time to their own
  // week. Named only when the viewer may see them (the viewer, their
  // friends); anyone else is a count.
  const withFor = (logId: string): string | null => {
    const ids = together.get(logId) ?? [];
    const shown = ids.filter((x) => x === me.id || friendIds.has(x));
    return withLine(
      shown.map((x) => (x === me.id ? "you" : firstNameOf(names.get(x) ?? "a teammate"))),
      ids.length - shown.length
    );
  };

  const activeToday = new Set(rows.filter((r) => r.trained_on === today).map((r) => r.profile_id));
  return {
    unlocked,
    faces: facesRow({ me, friends, activeToday }).map((f) => ({
      ...f,
      starred: starred.has(f.id),
      photo: photos.get(f.id) ?? null,
    })),
    friendCount: friends.length,
    friendsToday: friends.filter((f) => activeToday.has(f.id)).length,
    cards: cards.flatMap((c): FeedCardView[] => {
      if (c.state === "locked") return [{ ...c, photo: photos.get(c.ownerId) ?? null }];
      const photoUrl = urls.get(c.photoPath);
      if (!photoUrl) return []; // the photo could not be reached: no card
      const { photoPath: _path, createdAt, startPhotoPath: start, ...rest } = c;
      void _path;
      return [
        {
          ...rest,
          photoUrl,
          startPhotoUrl: start ? urls.get(start) ?? null : null,
          ago: timeSince({ day: c.day, createdAt }, nowMs, today),
          props: props.get(c.id)?.count ?? 0,
          propped: props.get(c.id)?.mine ?? false,
          together: withFor(c.id),
          starred: starred.has(c.ownerId),
          photo: photos.get(c.ownerId) ?? null,
        },
      ];
    }),
  };
}

// Who added each of these posts' time to their own week (trained
// together, 077). An unreachable table reads as nobody.
async function togetherOf(admin: Admin, logIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < logIds.length; i += 200) {
    const { data } = await admin
      .from("elite_trained_together")
      .select("log_id, tagged")
      .in("log_id", logIds.slice(i, i + 200))
      .eq("answer", "added");
    for (const r of (data as { log_id: string; tagged: string }[] | null) ?? []) out.set(r.log_id, [...(out.get(r.log_id) ?? []), r.tagged]);
  }
  return out;
}

// One post, with what this viewer is to it, for the actions that act on
// a single post (props, report). The post is only ever looked for among
// the viewer's own entries and their friends'.
export async function postForViewer(
  admin: Admin,
  profileId: string,
  logId: string,
  today: string
): Promise<{ post: PostRow; viewer: PhotoViewer } | null> {
  const friendIds = await friendIdsOf(admin, profileId);
  const among = [profileId, ...friendIds];
  let post: PostRow | null = null;
  for (let i = 0; i < among.length && !post; i += 200) {
    const { data } = await admin
      .from("elite_training_logs")
      .select(POST_COLUMNS)
      .in("profile_id", among.slice(i, i + 200))
      .eq("id", logId)
      .maybeSingle();
    post = (data as PostRow | null) ?? null;
  }
  if (!post) return null;
  const [mine, reported] = await Promise.all([
    admin.from("elite_training_logs").select(POST_COLUMNS).eq("profile_id", profileId).eq("trained_on", today),
    reportedBy(admin, profileId),
  ]);
  return {
    post,
    viewer: {
      id: profileId,
      staff: false,
      friendIds: new Set(friendIds),
      unlocked: postedPhotoToday((mine.data as PostRow[] | null) ?? [], profileId, today),
      reported,
    },
  };
}

// One entry in a player's own week: the one place a log without a photo
// is written (Log it without a photo, and a teammate's "Add it to your
// week" from a trained-together card, 077). The database holds the day's
// 8 hours (071); the caller has already checked gym is theirs to log
// (mayLog). NOT a server action.
export async function insertLog(
  admin: Admin,
  input: { profileId: string; day: string; minutes: number; kind: Kind; weekTarget: number | null }
): Promise<{ ok: true; id: string } | { ok: false; dayCap: boolean }> {
  const { data, error } = await admin
    .from("elite_training_logs")
    .insert({
      profile_id: input.profileId,
      trained_on: input.day,
      minutes: input.minutes,
      kind: input.kind,
      proof: TYPED, // the player said how long: their own week only
      week_target: input.weekTarget || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, dayCap: limitHit(error) === "day_cap" };
  return { ok: true, id: data.id as string };
}

// Store a post: the photo first, then the entry that points at it, so an
// entry never names a photo that is not there. NOT a server action: it
// is called only by the post route, with the id of the signed-in account
// and a photo the route has already checked. If the entry cannot be
// written, the photo is taken back out.
export async function savePost(input: {
  profileId: string;
  today: string;
  minutes: number;
  kind: Kind;
  caption: string | null;
  photo: Uint8Array;
  weekTarget: number | null; // the player's target right now, kept on the entry
}): Promise<{ ok: true; id: string } | { ok: false; dayCap?: boolean }> {
  const admin = createServiceClient();
  const id = crypto.randomUUID();
  const path = postPath(input.profileId, id);
  if (!admin || !path) return { ok: false };
  const up = await admin.storage
    .from(POST_BUCKET)
    .upload(path, input.photo, { contentType: "image/jpeg", upsert: false });
  if (up.error) return { ok: false };
  const { error } = await admin.from("elite_training_logs").insert({
    id,
    profile_id: input.profileId,
    trained_on: input.today,
    minutes: input.minutes,
    kind: input.kind,
    photo_path: path,
    caption: input.caption,
    proof: TYPED, // a photo with a typed length: friends see it, no board counts it
    week_target: input.weekTarget || null,
  });
  if (error) {
    await admin.storage.from(POST_BUCKET).remove([path]).catch(() => undefined);
    return { ok: false, dayCap: limitHit(error) === "day_cap" };
  }
  return { ok: true, id };
}

// "Post it to your friends" from a finished session (lib/elite/one-app.ts):
// the photo goes onto the session's OWN entry (lib/elite/session-log.ts),
// so the time is on the week once. The photo first, then the entry that
// points at it; an entry that already has a photo is left alone. NOT a
// server action: called only by the post route, with the signed-in
// account's id, an entry id worked out on the server and a checked photo.
export async function attachSessionPhoto(input: {
  profileId: string;
  logId: string;
  caption: string | null;
  photo: Uint8Array;
}): Promise<"ok" | "missing" | "posted" | "error"> {
  const admin = createServiceClient();
  const path = postPath(input.profileId, input.logId);
  if (!admin || !path) return "error";
  const { data: row, error: readError } = await admin
    .from("elite_training_logs")
    .select("id, photo_path")
    .eq("id", input.logId)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  if (readError) return "error";
  if (!row) return "missing";
  if ((row as { photo_path: string | null }).photo_path) return "posted";
  const up = await admin.storage.from(POST_BUCKET).upload(path, input.photo, { contentType: "image/jpeg", upsert: true });
  if (up.error) return "error";
  const { data: changed, error } = await admin
    .from("elite_training_logs")
    .update({ photo_path: path, caption: input.caption })
    .eq("id", input.logId)
    .eq("profile_id", input.profileId)
    .is("photo_path", null)
    .select("id");
  if (error || !changed?.length) {
    await admin.storage.from(POST_BUCKET).remove([path]).catch(() => undefined);
    return error ? "error" : "posted";
  }
  return "ok";
}

// Every photo an account ever posted, removed from storage. Called just
// before the account itself is deleted (its rows leave by cascade; files
// do not). Best effort: a storage hiccup never blocks the deletion.
export async function removeTrackerFiles(profileId: string): Promise<number> {
  const admin = createServiceClient();
  if (!admin) return 0;
  let removed = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(POST_BUCKET).list(profileId, { limit: 1000 });
    if (error || !data || data.length === 0) break;
    const { error: rmError } = await admin.storage
      .from(POST_BUCKET)
      .remove(data.map((f) => `${profileId}/${f.name}`));
    if (rmError) break;
    removed += data.length;
    if (data.length < 1000) break;
  }
  return removed;
}


// ---- Clubs ------------------------------------------------------------

export type ClubRow = {
  id: string;
  name: string;
  join_code: string;
  kind: ClubKind;
  captain_id: string | null;
  archived_at: string | null;
};
const CLUB_COLUMNS = "id, name, join_code, kind, captain_id, archived_at";
type MemberRow = { club_id: string; profile_id: string; joined_at: string };

export async function clubByCode(admin: Admin, code: string): Promise<ClubRow | null> {
  const { data } = await admin.from("elite_tracker_clubs").select(CLUB_COLUMNS).eq("join_code", code).maybeSingle();
  return (data as ClubRow | null) ?? null;
}

export async function clubById(admin: Admin, id: string): Promise<ClubRow | null> {
  const { data } = await admin.from("elite_tracker_clubs").select(CLUB_COLUMNS).eq("id", id).maybeSingle();
  return (data as ClubRow | null) ?? null;
}

// When a club was started (its weeks are read from then).
export async function clubStartedAt(admin: Admin, id: string): Promise<string | null> {
  const { data } = await admin.from("elite_tracker_clubs").select("created_at").eq("id", id).maybeSingle();
  return (data as { created_at: string } | null)?.created_at ?? null;
}

// The clubs a player is on.
export async function clubIdsOf(admin: Admin, profileId: string): Promise<string[]> {
  const { data } = await admin.from("elite_tracker_club_members").select("club_id").eq("profile_id", profileId);
  return ((data as { club_id: string }[] | null) ?? []).map((r) => r.club_id);
}

// Everyone on a club, the longest-standing first.
export async function membersOf(admin: Admin, clubId: string): Promise<MemberRow[]> {
  const { data } = await admin
    .from("elite_tracker_club_members")
    .select("club_id, profile_id, joined_at")
    .eq("club_id", clubId)
    .order("joined_at")
    .order("profile_id");
  return (data as MemberRow[] | null) ?? [];
}

// An account that is about to be deleted hands over every club it
// captains, by the same rule as a captain who leaves (the member who has
// been in the club longest; nobody left: the club ends). Without this the
// club keeps its players and loses its captain, and nobody can let a
// player in. Called before the login is deleted; best effort per club.
export async function handOverClubsOf(admin: Admin, profileId: string): Promise<void> {
  const { data } = await admin.from("elite_tracker_clubs").select("id").eq("captain_id", profileId).is("archived_at", null);
  for (const club of (data as { id: string }[] | null) ?? []) {
    const next = nextCaptain(await membersOf(admin, club.id), profileId);
    await admin
      .from("elite_tracker_clubs")
      .update(next ? { captain_id: next } : { captain_id: null, archived_at: new Date().toISOString() })
      .eq("id", club.id)
      .eq("captain_id", profileId);
  }
}

// Make a club with a fresh link code. NOT a server action: called by the
// player's Start a club and the coach's create, each after its own check.
export async function newClub(input: {
  name: string;
  kind: ClubKind;
  captainId: string | null;
  createdBy: string;
}): Promise<ClubRow | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await admin
      .from("elite_tracker_clubs")
      .insert({
        name: input.name,
        join_code: newReferralCode(),
        kind: input.kind,
        captain_id: input.captainId,
        created_by: input.createdBy,
      })
      .select(CLUB_COLUMNS)
      .single();
    if (!error && data) return data as ClubRow;
  }
  return null;
}

// Put a free account on a club and make it friends with every member
// already on it (both ways, one stored pair each), skipping anyone a
// block stands between. Never past either cap, never an ended club. NOT a
// server action: called only by the sign-up route (the account it just
// made), the confirm action and Start a club (the signed-in viewer), each
// with an id it established for itself.
export async function joinClub(profileId: string, club: ClubRow): Promise<ClubJoin | "error"> {
  const admin = createServiceClient();
  if (!admin) return "error";
  const members = await membersOf(admin, club.id);
  const decision = clubJoinDecision({
    clubId: club.id,
    archived: Boolean(club.archived_at),
    memberCount: members.length,
    myClubIds: await clubIdsOf(admin, profileId),
  });
  if (decision !== "ok") return decision;

  const { error } = await admin.from("elite_tracker_club_members").insert({ club_id: club.id, profile_id: profileId });
  if (error) {
    // the database holds the caps and the captain's removals (071)
    const hit = limitHit(error);
    if (hit === "club_full") return "full";
    if (hit === "club_too_many") return "too_many";
    if (hit === "club_removed") return "removed";
    return "error";
  }
  // Two players joining at the same moment can pass the count together:
  // the later one steps back out so a club never goes past the cap.
  const after = await membersOf(admin, club.id);
  if (after.length > CLUB_CAP && !after.slice(0, CLUB_CAP).some((m) => m.profile_id === profileId)) {
    await admin.from("elite_tracker_club_members").delete().eq("club_id", club.id).eq("profile_id", profileId);
    return "full";
  }

  const others = after.map((m) => m.profile_id).filter((id) => id !== profileId);
  const blocks: Block[] = [];
  for (let i = 0; i < others.length; i += 200) {
    const some = others.slice(i, i + 200);
    const [mine, theirs] = await Promise.all([
      admin.from("elite_tracker_blocks").select("blocker, blocked").eq("blocker", profileId).in("blocked", some),
      admin.from("elite_tracker_blocks").select("blocker, blocked").eq("blocked", profileId).in("blocker", some),
    ]);
    blocks.push(...((mine.data as Block[] | null) ?? []), ...((theirs.data as Block[] | null) ?? []));
  }
  const pairs = clubPairs(profileId, others, blocks);
  if (pairs.length > 0) {
    await admin.from("elite_tracker_friends").upsert(pairs, { onConflict: "a,b", ignoreDuplicates: true });
  }
  return "ok";
}

// ---- Club requests (073) -------------------------------------------------

// A club's link (opened signed in, or joined with at sign-up) asks to join.
// The same refusals a join would meet are given now, so a player is never
// left waiting on a club they could not join.
export type ClubRequestResult = ClubJoin | "requested" | "requests_full" | "none" | "error";

export async function requestClub(profileId: string, club: ClubRow): Promise<ClubRequestResult> {
  const admin = createServiceClient();
  if (!admin) return "error";
  const decision = clubJoinDecision({
    clubId: club.id,
    archived: Boolean(club.archived_at),
    memberCount: (await membersOf(admin, club.id)).length,
    myClubIds: await clubIdsOf(admin, profileId),
  });
  if (decision !== "ok") return decision;
  const { data: ban } = await admin
    .from("elite_tracker_club_bans")
    .select("club_id")
    .eq("club_id", club.id)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (ban) return "removed";
  const { count } = await admin
    .from("elite_tracker_club_requests")
    .select("club_id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if ((count ?? 0) >= CLUB_REQUESTS_PENDING_MAX) return "requests_full";
  const { error } = await admin
    .from("elite_tracker_club_requests")
    .upsert({ club_id: club.id, profile_id: profileId }, { onConflict: "club_id,profile_id", ignoreDuplicates: true });
  return error ? "error" : "requested";
}

export async function requestClubByCode(profileId: string, code: string): Promise<ClubRequestResult> {
  const admin = createServiceClient();
  if (!admin) return "error";
  const club = await clubByCode(admin, code);
  return club ? requestClub(profileId, club) : "none";
}

// The requests a captain answers: players asking into the clubs this viewer
// captains. First name and last initial, no photo, until they are in.
export type ClubRequestView = { clubId: string; club: string; id: string; name: string; initials: string };

export async function clubRequestsFor(viewer: Viewer): Promise<ClubRequestView[]> {
  if (viewer.demo) return [];
  const admin = createServiceClient();
  if (!admin) return [];
  const { data: clubs } = await admin
    .from("elite_tracker_clubs")
    .select("id, name")
    .eq("captain_id", viewer.profile.id)
    .is("archived_at", null);
  const mine = (clubs as { id: string; name: string }[] | null) ?? [];
  if (mine.length === 0) return [];
  const { data } = await admin
    .from("elite_tracker_club_requests")
    .select("club_id, profile_id, created_at")
    .in(
      "club_id",
      mine.map((c) => c.id)
    )
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data as { club_id: string; profile_id: string }[] | null) ?? [];
  if (rows.length === 0) return [];
  const names = await namesOf(admin, rows.map((r) => r.profile_id));
  const clubName = new Map(mine.map((c) => [c.id, c.name]));
  return rows.map((r) => {
    const name = names.get(r.profile_id) ?? "A teammate";
    return { clubId: r.club_id, club: clubName.get(r.club_id) ?? "Your club", id: r.profile_id, name, initials: initialsOf(name) };
  });
}

// Let a player in, or not. Only the club's captain answers for a player's
// club; the coaches answer for any club (a club a coach made has no
// captain). Either answer takes the request away; letting in goes through
// joinClub, so the caps, a removal and the friendships work as before.
export async function answerClubRequest(input: {
  approverId: string;
  approverIsCoach: boolean;
  clubId: string;
  requesterId: string;
  accept: boolean;
}): Promise<ClubJoin | "none" | "not_yours" | "error"> {
  const admin = createServiceClient();
  if (!admin) return "error";
  const club = await clubById(admin, input.clubId);
  if (!club) return "none";
  if (!input.approverIsCoach && club.captain_id !== input.approverId) return "not_yours";
  const { data: request } = await admin
    .from("elite_tracker_club_requests")
    .select("profile_id")
    .eq("club_id", club.id)
    .eq("profile_id", input.requesterId)
    .maybeSingle();
  if (!request) return "none";
  await admin.from("elite_tracker_club_requests").delete().eq("club_id", club.id).eq("profile_id", input.requesterId);
  if (!input.accept) return "ok";
  const joined = await joinClub(input.requesterId, club);
  return joined === "already" ? "ok" : joined;
}

// The club behind a link, asked about once on the Friends tab. A club the
// player is already on, or no club at all, asks nothing; a club they
// cannot join says why in plain words.
export async function clubAskFor(
  viewer: Viewer,
  code: string | null
): Promise<{ code: string; name: string; problem: string | null; byCoach: boolean } | null> {
  if (!code) return null;
  if (viewer.demo) {
    const c = demoClubAsk(code);
    return c ? { code, name: c.name, problem: null, byCoach: false } : null;
  }
  const admin = createServiceClient();
  if (!admin) return null;
  const club = await clubByCode(admin, code);
  if (!club) return null;
  const decision = clubJoinDecision({
    clubId: club.id,
    archived: Boolean(club.archived_at),
    memberCount: (await membersOf(admin, club.id)).length,
    myClubIds: await clubIdsOf(admin, viewer.profile.id),
  });
  if (decision === "already") return null;
  if (decision === "ok") {
    const { data: ban } = await admin
      .from("elite_tracker_club_bans")
      .select("club_id")
      .eq("club_id", club.id)
      .eq("profile_id", viewer.profile.id)
      .maybeSingle();
    if (ban) return { code, name: club.name, problem: CLUB_REFUSED.removed, byCoach: club.kind === "coach" };
    // a request already on its way is not asked again
    const { data: pending } = await admin
      .from("elite_tracker_club_requests")
      .select("club_id")
      .eq("club_id", club.id)
      .eq("profile_id", viewer.profile.id)
      .maybeSingle();
    if (pending) return null;
  }
  return { code, name: club.name, problem: decision === "ok" ? null : CLUB_REFUSED[decision], byCoach: club.kind === "coach" };
}

// This viewer's own clubs, with their rosters (first name and last
// initial, a photo where the viewer may see it, this week's training and
// the last day each logged anything). Only ever the viewer's own clubs.
export async function myClubsFor(viewer: Viewer, today: string): Promise<MyClub[]> {
  const me = { id: viewer.profile.id, name: shortName(viewer.profile.full_name) };
  if (viewer.demo) {
    const logs = demoLogs(today);
    const { monday } = weekOf(today);
    const mine = {
      minutes: logs.reduce((s, l) => (l.kind === "training" && l.trained_on >= monday ? s + l.minutes : s), 0),
      lastDay: logs.map((l) => l.trained_on).sort().pop() ?? null,
    };
    return demoMyClubs(me, mine, today);
  }
  const admin = createServiceClient();
  if (!admin) return [];
  const ids = await clubIdsOf(admin, me.id);
  const out: MyClub[] = [];
  const { monday } = weekOf(today);
  for (const id of ids) {
    const [club, members] = await Promise.all([clubById(admin, id), membersOf(admin, id)]);
    if (!club) continue;
    const memberIds = members.map((m) => m.profile_id);
    const others = memberIds.filter((x) => x !== me.id);
    const [names, starred, blocks, recent] = await Promise.all([
      namesOf(admin, memberIds),
      starredAmong(admin, memberIds),
      blocksWith(admin, me.id, others),
      entriesOf(admin, memberIds, shiftDay(today, -60), today),
    ]);
    const blockedIds = new Set(blocks.flatMap((b) => [b.blocker, b.blocked]).filter((x) => x !== me.id));
    // a photo only for the viewer and for members who are friends right
    // now (a friend taken off keeps the club, not the photo)
    const friendNow = new Set(await friendIdsOf(admin, me.id));
    const photos = await avatarsOf(admin, memberIds.filter((x) => x === me.id || (friendNow.has(x) && !blockedIds.has(x))));
    const minutes = new Map<string, number>();
    const lastDay = new Map<string, string>();
    for (const r of recent) {
      if (onBoards(r) && r.trained_on >= monday) minutes.set(r.profile_id, (minutes.get(r.profile_id) ?? 0) + r.minutes);
      if ((lastDay.get(r.profile_id) ?? "") < r.trained_on) lastDay.set(r.profile_id, r.trained_on);
    }
    out.push({
      id: club.id,
      name: club.name,
      code: club.join_code,
      kind: club.kind,
      captain: club.captain_id === me.id && !club.archived_at,
      ended: Boolean(club.archived_at),
      // a block hides each from the other here too
      members: members.filter((m) => !blockedIds.has(m.profile_id)).map((m) => ({
        id: m.profile_id,
        name: m.profile_id === me.id ? me.name : names.get(m.profile_id) ?? "A teammate",
        captain: club.captain_id === m.profile_id,
        you: m.profile_id === me.id,
        starred: starred.has(m.profile_id),
        photo: photos.get(m.profile_id) ?? null,
        minutes: minutes.get(m.profile_id) ?? 0,
        lastDay: lastDay.get(m.profile_id) ?? null,
      })),
    });
  }
  return out;
}

// One club's page: only for its members and coaches. The header photo is
// the newest post from a member that the viewer may see (the feed's own
// rules), else none; the rest is the roster and this week's numbers.
export type ClubPage = {
  club: MyClub;
  startedBy: string | null;
  place: number | null; // null while the club has fewer than 3 members
  total: number; // clubs ranked this week
  perPlayer: number;
  weekTotal: number;
  heroUrl: string | null;
};

export async function clubPageFor(viewer: Viewer, clubId: string, today: string): Promise<ClubPage | null> {
  const staff = viewer.role !== "player";
  const mine = await myClubsFor(viewer, today);
  let club = mine.find((c) => c.id === clubId) ?? null;
  if (!club && !staff) return null;
  const { rows, total } = await clubRankingFor(viewer, today);
  let startedBy: string | null = null;
  let heroUrl: string | null = null;

  if (viewer.demo) {
    if (!club) return null;
    startedBy = club.kind === "coach" ? "Coach Yinka" : club.captain ? "you" : null;
    heroUrl = club.id === "demo-club-1" ? "/free-demo/post-yinka-1.jpg" : null;
  } else {
    const admin = createServiceClient();
    if (!admin) return null;
    const row = await clubById(admin, clubId);
    if (!row) return null;
    if (!club) {
      // a coach opening a club they are not on: the roster, no photos of
      // anyone's posts beyond what a coach already sees in the queue
      const members = await membersOf(admin, clubId);
      const names = await namesOf(admin, members.map((m) => m.profile_id));
      club = {
        id: row.id,
        name: row.name,
        code: row.join_code,
        kind: row.kind,
        captain: false,
        ended: Boolean(row.archived_at),
        members: members.map((m) => ({
          id: m.profile_id,
          name: names.get(m.profile_id) ?? "A teammate",
          captain: row.captain_id === m.profile_id,
          you: false,
        })),
      };
    }
    const { data: made } = await admin.from("elite_tracker_clubs").select("created_by").eq("id", clubId).maybeSingle();
    const by = (made as { created_by: string | null } | null)?.created_by ?? null;
    if (by) {
      const { data: p } = await admin.from("elite_profiles").select("full_name, role").eq("id", by).maybeSingle();
      const person = p as { full_name: string | null; role: string } | null;
      if (person) {
        startedBy =
          by === viewer.profile.id
            ? "you"
            : person.role === "player"
              ? shortName(person.full_name ?? "")
              : `Coach ${firstNameOf(person.full_name ?? "")}`;
      }
    }
    if (!staff) {
      const memberIds = club.members.map((m) => m.id);
      const [friendIds, posts, reported] = await Promise.all([
        friendIdsOf(admin, viewer.profile.id),
        entriesOf(admin, [...new Set([viewer.profile.id, ...memberIds])], feedSince(today), today),
        reportedBy(admin, viewer.profile.id),
      ]);
      const photoViewer: PhotoViewer = {
        id: viewer.profile.id,
        staff: false,
        friendIds: new Set(friendIds),
        unlocked: postedPhotoToday(posts, viewer.profile.id, today),
        reported,
      };
      const latest = posts
        .filter((p) => memberIds.includes(p.profile_id) && mayViewPhoto(p, photoViewer, today))
        .sort((x: PostRow, y: PostRow) => y.created_at.localeCompare(x.created_at))[0];
      if (latest?.photo_path) heroUrl = (await signPhotos(admin, [latest.photo_path])).get(latest.photo_path) ?? null;
    }
  }

  const weekTotal = club.members.reduce((s, m) => s + (m.minutes ?? 0), 0);
  const perPlayer = club.members.length ? Math.round(weekTotal / club.members.length) : 0;
  const ranked = rows.find((r) => r.id === club!.id);
  return { club, startedBy, place: ranked ? ranked.place : null, total, perPlayer, weekTotal, heroUrl };
}

// A player's profile: only for that player, their friends, and coaches,
// and never across a block. Anyone else gets nothing back at all. The
// grid holds only the posts the viewer may see (the feed's rules).
export async function profileFor(viewer: Viewer, targetId: string, today: string): Promise<Profile | null> {
  const meId = viewer.profile.id;
  const staff = viewer.role !== "player";
  const you = targetId === meId;
  const { monday } = weekOf(today);
  const nowMs = Date.now();

  if (viewer.demo) {
    const friends = demoFriends();
    const friend = friends.find((f) => f.id === targetId);
    if (!you && !friend && !staff) return null;
    const name = you ? shortName(viewer.profile.full_name) : friend?.name ?? "A teammate";
    const tracker = you ? demoTracker(meId) : null;
    const logs = demoLogs(today);
    const thisWeek = logs.filter((l) => l.trained_on >= monday);
    const extra = demoAuraOf(name);
    const rows = demoPostRows(meId, today, nowMs);
    const state = readDemoState();
    const photoViewer: PhotoViewer = {
      id: meId,
      staff,
      friendIds: new Set(friends.map((f) => f.id)),
      unlocked: postedPhotoToday(rows, meId, today),
      reported: new Set(state.reported ?? []),
    };
    const grid = profilePosts(rows, targetId, photoViewer, today);
    const props = demoProps();
    const top = !you && !staff ? grid.find((g) => mayGiveProps(rows.find((r) => r.id === g.id)!, photoViewer, today)) : undefined;
    const weekMinutes = you
      ? thisWeek.reduce((s, l) => (l.kind === "training" ? s + l.minutes : s), 0)
      : friend?.minutes ?? 0;
    return {
      id: targetId,
      name,
      initials: initialsOf(name),
      photo: you ? demoMyPhoto() : demoPhotoOf(name),
      clubs: you ? demoMyClubs({ id: meId, name }).map((c) => ({ id: c.id, name: c.name })) : demoClubsOf(name),
      weekMinutes,
      allMinutes: you ? logs.reduce((s, l) => (l.kind === "training" ? s + l.minutes : s), 0) : Math.round(extra.points * 0.85),
      you,
      friend: Boolean(friend),
      posts: grid.map(({ photoPath, ...g }) => ({ ...g, photoUrl: photoPath })),
      week: you
        ? thisWeek.map((l) => ({ day: l.trained_on, minutes: l.minutes, kind: l.kind }))
        : rows
            .filter((r) => r.profile_id === targetId && r.trained_on >= monday)
            .map((r) => ({ day: r.trained_on, minutes: r.minutes, kind: r.kind })),
      propsPost: top ? { id: top.id, propped: props.get(top.id)?.mine ?? false } : null,
      aura: auraLevel(
        you
          ? auraPoints(logs.map((l) => ({ ...l, photo: Boolean(l.photo) })), tracker?.target_minutes ?? 0)
          : extra.points
      ),
      levelName: labelOf(LEVELS, you ? tracker?.level : extra.level) || null,
      playingFor: you ? tracker?.playing_for ?? null : extra.playingFor,
      starred: !you && extra.starred,
    };
  }

  const admin = createServiceClient();
  if (!admin) return null;
  const friendIdList = staff ? [] : await friendIdsOf(admin, meId);
  const friendIds = new Set(friendIdList);
  const blocks = you || staff ? [] : await blocksBetween(admin, meId, targetId);
  if (!mayViewProfile({ viewerId: meId, staff, targetId, friendIds: you ? new Set() : friendIds, blocks })) return null;
  const tracker = await getTracker(targetId);
  if (!tracker) return null;

  const [names, clubIds, logs, photos, theirs, mineToday, reported, usernames] = await Promise.all([
    namesOf(admin, [targetId]),
    clubIdsOf(admin, targetId),
    auraLogsOf(admin, targetId),
    avatarsOf(admin, [targetId]),
    admin
      .from("elite_training_logs")
      .select(POST_COLUMNS)
      .eq("profile_id", targetId)
      .not("photo_path", "is", null)
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(GRID_FETCH),
    admin.from("elite_training_logs").select(POST_COLUMNS).eq("profile_id", meId).eq("trained_on", today),
    reportedBy(admin, meId),
    usernamesOf(admin, [targetId]),
  ]);
  const clubs: { id: string; name: string }[] = [];
  for (const id of clubIds) {
    const club = await clubById(admin, id);
    if (club && !club.archived_at) clubs.push({ id: club.id, name: club.name });
  }
  const postRows = (theirs.data as PostRow[] | null) ?? [];
  const photoViewer: PhotoViewer = {
    id: meId,
    staff,
    friendIds,
    unlocked: postedPhotoToday((mineToday.data as PostRow[] | null) ?? [], meId, today),
    reported,
  };
  const grid = profilePosts(postRows, targetId, photoViewer, today);
  const urls = await signPhotos(admin, grid.map((g) => g.photoPath));
  const top = !you && !staff ? grid.find((g) => mayGiveProps(postRows.find((r) => r.id === g.id)!, photoViewer, today)) : undefined;
  let propsPost: Profile["propsPost"] = null;
  if (top) {
    const { data } = await admin.from("elite_log_props").select("profile_id").eq("log_id", top.id).eq("profile_id", meId);
    propsPost = { id: top.id, propped: ((data as unknown[] | null) ?? []).length > 0 };
  }
  const name = names.get(targetId) ?? "A teammate";
  return {
    id: targetId,
    name,
    initials: initialsOf(name),
    photo: photos.get(targetId) ?? null,
    clubs,
    weekMinutes: logs.reduce((s, l) => (l.kind === "training" && l.trained_on >= monday ? s + l.minutes : s), 0),
    allMinutes: logs.reduce((s, l) => (l.kind === "training" ? s + l.minutes : s), 0),
    you,
    friend: friendIds.has(targetId),
    posts: grid.flatMap(({ photoPath, ...g }) => {
      const photoUrl = urls.get(photoPath);
      return photoUrl ? [{ ...g, photoUrl }] : [];
    }),
    week: logs
      .filter((l) => l.trained_on >= monday)
      .map((l) => ({ day: l.trained_on, minutes: l.minutes, kind: l.kind }))
      .sort((x, y) => y.day.localeCompare(x.day)),
    propsPost,
    aura: auraLevel(auraPoints(logs, tracker.target_minutes ?? 0)),
    levelName: labelOf(LEVELS, tracker.level) || null,
    playingFor: tracker.playing_for,
    starred: Boolean(tracker.starred_at),
    username: usernames.get(targetId) ?? null,
  };
}

// How many of a player's newest posts a profile reads before the rules
// decide which the viewer may see.
const GRID_FETCH = 60;

// What a signed-out visitor sees on an invite link: who sent it, by first
// name and initials. Never a photo of them or of their training: a
// visitor is nobody's friend yet, and photos go to friends only.
export type InviteLanding =
  | { kind: "friend"; first: string; initials: string }
  | { kind: "club"; name: string; letters: string; clubId: string };

export async function inviteLandingFor(ref: string | null, club: string | null): Promise<InviteLanding | null> {
  if (!isSupabaseConfigured()) {
    if (club === DEMO_CLUB_ASK.code) return { kind: "club", name: "Saturday Pickup", letters: "SP", clubId: "demo-club-3" };
    if (ref) return { kind: "friend", first: "Gary", initials: "GG" };
    if (club) return { kind: "club", name: "Strive Elite 5v5: Team 7", letters: "T7", clubId: "demo-club-1" };
    return null;
  }
  const admin = createServiceClient();
  if (!admin) return null;
  if (club) {
    const row = await clubByCode(admin, club);
    if (row && !row.archived_at) return { kind: "club", name: row.name, letters: crestOf(row).letters, clubId: row.id };
  }
  if (ref) {
    const { data } = await admin.from("elite_trackers").select("profile_id").eq("referral_code", ref).maybeSingle();
    const id = (data as { profile_id: string } | null)?.profile_id;
    if (id) {
      const name = (await namesOf(admin, [id])).get(id) ?? "";
      if (name) return { kind: "friend", first: firstNameOf(name), initials: initialsOf(name) };
    }
  }
  return null;
}

// Every entry an account ever logged, as aura reads it: the minutes, the
// kind, the day, and whether it is a photo still up.
export async function auraLogsOf(admin: Admin, profileId: string): Promise<AuraLog[]> {
  const out: AuraLog[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("elite_training_logs")
      .select("id, trained_on, minutes, kind, photo_path, removed_at, week_target, created_at")
      .eq("profile_id", profileId)
      .neq("proof", TYPED) // the level is earned by timed training only
      .order("id")
      .range(from, from + 999);
    const rows =
      (data as
        | (TrainingLog & {
            photo_path: string | null;
            removed_at: string | null;
            week_target: number | null;
            created_at: string;
          })[]
        | null) ?? [];
    for (const r of rows) {
      out.push({
        trained_on: r.trained_on,
        minutes: r.minutes,
        kind: r.kind,
        photo: Boolean(r.photo_path) && !r.removed_at,
        week_target: r.week_target,
        at: r.created_at,
      });
    }
    if (rows.length < 1000) break;
  }
  return out;
}
