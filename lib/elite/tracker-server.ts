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
import type { Viewer } from "./session";
import { shiftDay } from "./time";
import { clubRankingFor } from "./tracker-ranking";
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
} from "./tracker";
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
    .select("id, trained_on, minutes, kind, created_at, photo_path, removed_at")
    .eq("profile_id", profileId)
    .gte("trained_on", monday)
    .lte("trained_on", sunday)
    .order("trained_on", { ascending: false })
    .order("created_at", { ascending: false });
  type Row = TrainingLog & { photo_path: string | null; removed_at: string | null };
  return ((data as Row[] | null) ?? []).map(({ photo_path, removed_at, ...l }) => ({
    ...l,
    photo: Boolean(photo_path) && !removed_at,
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
  const [starred, photos] = await Promise.all([starredAmong(admin, ids), avatarsOf(admin, ids)]);
  return ids.map((id) => ({
    id,
    name: shortName(names.get(id) ?? ""),
    minutes: minutes.get(id) ?? 0,
    starred: starred.has(id),
    photo: photos.get(id) ?? null,
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
  if (blockedEitherWay(await blocksBetween(admin, viewer.profile.id, ownerId), viewer.profile.id, ownerId)) return null;
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
// repeat. Refused while either has blocked the other: the link can never
// undo a block. NOT a server action (this file is not one): it is called
// only by code that has already established both ids for itself, the
// sign-up route (who sent the link) and the confirm action (the signed-in
// viewer and the owner of the code they opened).
export async function makeFriends(x: string, y: string): Promise<"ok" | "blocked" | "error"> {
  const pair = friendPair(x, y);
  const admin = createServiceClient();
  if (!pair || !admin) return "error";
  if (blockedEitherWay(await blocksBetween(admin, x, y), x, y)) return "blocked";
  const { error } = await admin
    .from("elite_tracker_friends")
    .upsert(pair, { onConflict: "a,b", ignoreDuplicates: true });
  return error ? "error" : "ok";
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
// ever taken from the browser.
export async function avatarsOf(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const paths = new Map<string, string>(); // path -> profile id
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin
      .from("elite_trackers")
      .select("profile_id, avatar_path")
      .in("profile_id", ids.slice(i, i + 200))
      .not("avatar_path", "is", null);
    for (const r of (data as { profile_id: string; avatar_path: string }[] | null) ?? []) {
      if (ownsAvatarPath(r.avatar_path, r.profile_id)) paths.set(r.avatar_path, r.profile_id);
    }
  }
  const signed = await signPhotos(admin, [...paths.keys()]);
  const out = new Map<string, string>();
  for (const [path, url] of signed) {
    const id = paths.get(path);
    if (id) out.set(id, url);
  }
  return out;
}

// Store a new profile photo for the signed-in player, replacing the old
// one. NOT a server action: called only by the photo route, with the id
// it established from the session and a photo it already checked.
export async function saveAvatar(profileId: string, photo: Uint8Array): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) return false;
  if (!looksLikeJpeg(photo) || photo.length > AVATAR_MAX_BYTES) return false;
  const path = avatarPath(profileId, crypto.randomUUID());
  if (!path) return false;
  const { data: before } = await admin.from("elite_trackers").select("avatar_path").eq("profile_id", profileId).maybeSingle();
  const up = await admin.storage.from(POST_BUCKET).upload(path, photo, { contentType: "image/jpeg", upsert: false });
  if (up.error) return false;
  const { error } = await admin.from("elite_trackers").update({ avatar_path: path }).eq("profile_id", profileId);
  if (error) {
    await admin.storage.from(POST_BUCKET).remove([path]).catch(() => undefined);
    return false;
  }
  const old = (before as { avatar_path: string | null } | null)?.avatar_path;
  if (old && ownsAvatarPath(old, profileId)) await admin.storage.from(POST_BUCKET).remove([old]).catch(() => undefined);
  return true;
}

// Take a player's profile photo off: the file and the pointer. Used by the
// player for their own and by a coach from the queue.
export async function clearAvatar(profileId: string): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) return false;
  const { data } = await admin.from("elite_trackers").select("avatar_path").eq("profile_id", profileId).maybeSingle();
  const old = (data as { avatar_path: string | null } | null)?.avatar_path;
  const { error } = await admin.from("elite_trackers").update({ avatar_path: null }).eq("profile_id", profileId);
  if (error) return false;
  if (old && ownsAvatarPath(old, profileId)) await admin.storage.from(POST_BUCKET).remove([old]).catch(() => undefined);
  return true;
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
async function blocksWith(admin: Admin, profileId: string, ids: string[]): Promise<Block[]> {
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

const POST_COLUMNS = "id, profile_id, trained_on, minutes, kind, created_at, photo_path, caption, removed_at";

// First name and last initial for a list of accounts.
async function namesOf(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("elite_profiles").select("id, full_name").in("id", ids.slice(i, i + 200));
    for (const p of data ?? []) names.set(p.id as string, shortName((p.full_name as string) ?? ""));
  }
  return names;
}

// Every entry these accounts logged between two days, photo or not.
async function entriesOf(admin: Admin, ids: string[], since: string, until: string): Promise<PostRow[]> {
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
async function reportedBy(admin: Admin, profileId: string): Promise<Set<string>> {
  const { data } = await admin.from("elite_post_reports").select("log_id").eq("reporter_id", profileId);
  return new Set(((data as { log_id: string }[] | null) ?? []).map((r) => r.log_id));
}

// Signed addresses for stored photos, good for a few minutes. Asked for
// open cards only; a path that could not be signed is simply left out.
async function signPhotos(admin: Admin, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data } = await admin.storage.from(POST_BUCKET).createSignedUrls(paths, POST_URL_SECONDS);
  for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  return out;
}

// One card as the screen gets it. An open card carries the photo's
// address; a locked card carries a name and a time and nothing else.
export type OpenCardView = Omit<OpenCard, "photoPath" | "createdAt"> & {
  photoUrl: string;
  ago: string;
  props: number;
  propped: boolean;
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
  const [urls, props] = await Promise.all([
    sign(open.map((c) => c.photoPath)),
    propsOf(open.map((c) => c.id)),
  ]);

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
      const { photoPath: _path, createdAt, ...rest } = c;
      void _path;
      return [
        {
          ...rest,
          photoUrl,
          ago: timeSince({ day: c.day, createdAt }, nowMs, today),
          props: props.get(c.id)?.count ?? 0,
          propped: props.get(c.id)?.mine ?? false,
          starred: starred.has(c.ownerId),
          photo: photos.get(c.ownerId) ?? null,
        },
      ];
    }),
  };
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
}): Promise<{ ok: true; id: string } | { ok: false }> {
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
    week_target: input.weekTarget || null,
  });
  if (error) {
    await admin.storage.from(POST_BUCKET).remove([path]).catch(() => undefined);
    return { ok: false };
  }
  return { ok: true, id };
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

async function clubByCode(admin: Admin, code: string): Promise<ClubRow | null> {
  const { data } = await admin.from("elite_tracker_clubs").select(CLUB_COLUMNS).eq("join_code", code).maybeSingle();
  return (data as ClubRow | null) ?? null;
}

export async function clubById(admin: Admin, id: string): Promise<ClubRow | null> {
  const { data } = await admin.from("elite_tracker_clubs").select(CLUB_COLUMNS).eq("id", id).maybeSingle();
  return (data as ClubRow | null) ?? null;
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
  if (error) return "error";
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

export async function joinClubByCode(profileId: string, code: string): Promise<ClubJoin | "none" | "error"> {
  const admin = createServiceClient();
  if (!admin) return "error";
  const club = await clubByCode(admin, code);
  return club ? joinClub(profileId, club) : "none";
}

// The club behind a link, asked about once on the Friends tab. A club the
// player is already on, or no club at all, asks nothing; a club they
// cannot join says why in plain words.
export async function clubAskFor(
  viewer: Viewer,
  code: string | null
): Promise<{ code: string; name: string; problem: string | null } | null> {
  if (!code) return null;
  if (viewer.demo) {
    const c = demoClubAsk(code);
    return c ? { code, name: c.name, problem: null } : null;
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
  return { code, name: club.name, problem: decision === "ok" ? null : CLUB_REFUSED[decision] };
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
    // a photo only for the viewer and for members not behind a block
    // (joining a club made every other member a friend)
    const photos = await avatarsOf(admin, memberIds.filter((x) => !blockedIds.has(x)));
    const minutes = new Map<string, number>();
    const lastDay = new Map<string, string>();
    for (const r of recent) {
      if (r.kind === "training" && r.trained_on >= monday) minutes.set(r.profile_id, (minutes.get(r.profile_id) ?? 0) + r.minutes);
      if ((lastDay.get(r.profile_id) ?? "") < r.trained_on) lastDay.set(r.profile_id, r.trained_on);
    }
    out.push({
      id: club.id,
      name: club.name,
      code: club.join_code,
      kind: club.kind,
      captain: club.captain_id === me.id && !club.archived_at,
      ended: Boolean(club.archived_at),
      members: members.map((m) => ({
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

  const [names, clubIds, logs, photos, theirs, mineToday, reported] = await Promise.all([
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
