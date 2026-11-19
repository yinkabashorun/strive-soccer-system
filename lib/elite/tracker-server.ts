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
  clubJoinDecision,
  clubPairs,
  initialsOf,
  mayViewProfile,
  newReferralCode,
  shortName,
  timeSince,
  tracksGym,
  weekOf,
  type Block,
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
  created_at: string;
};

export const TRACKER_COLUMNS =
  "profile_id, phone, birth_year, birth_month, grade, level, season, goal, target_minutes, plan_days, quiz_done_at, referral_code, referred_by, created_at";

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

  const admin = viewer.demo ? null : createServiceClient();
  if (!admin) {
    // the example account: the same rules, example rows, photos that are
    // plain files of the example
    friends = demoFriends();
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
    faces: facesRow({ me, friends, activeToday }),
    friendCount: friends.length,
    friendsToday: friends.filter((f) => activeToday.has(f.id)).length,
    cards: cards.flatMap((c): FeedCardView[] => {
      if (c.state === "locked") return [c];
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
// initial). Only ever the viewer's own clubs.
export async function myClubsFor(viewer: Viewer): Promise<MyClub[]> {
  const me = { id: viewer.profile.id, name: shortName(viewer.profile.full_name) };
  if (viewer.demo) return demoMyClubs(me);
  const admin = createServiceClient();
  if (!admin) return [];
  const ids = await clubIdsOf(admin, me.id);
  const out: MyClub[] = [];
  for (const id of ids) {
    const [club, members] = await Promise.all([clubById(admin, id), membersOf(admin, id)]);
    if (!club) continue;
    const names = await namesOf(admin, members.map((m) => m.profile_id));
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
      })),
    });
  }
  return out;
}

// A player's profile: only for that player, their friends, and coaches,
// and never across a block. Anyone else gets nothing back at all.
export async function profileFor(viewer: Viewer, targetId: string, today: string): Promise<Profile | null> {
  const meId = viewer.profile.id;
  const staff = viewer.role !== "player";
  const you = targetId === meId;

  if (viewer.demo) {
    const friends = demoFriends();
    const friend = friends.find((f) => f.id === targetId);
    if (!you && !friend && !staff) return null;
    const name = you ? shortName(viewer.profile.full_name) : friend?.name ?? "A teammate";
    const myLogs = you ? demoLogs(today).filter((l) => l.trained_on >= weekOf(today).monday) : [];
    return {
      id: targetId,
      name,
      initials: initialsOf(name),
      clubs: you ? demoMyClubs({ id: meId, name }).map((c) => c.name) : demoClubsOf(name),
      weekMinutes: you
        ? myLogs.reduce((s, l) => (l.kind === "training" ? s + l.minutes : s), 0)
        : friend?.minutes ?? 0,
      you,
    };
  }

  const admin = createServiceClient();
  if (!admin) return null;
  const friendIds = new Set(you || staff ? [] : await friendIdsOf(admin, meId));
  const blocks = you || staff ? [] : await blocksBetween(admin, meId, targetId);
  if (!mayViewProfile({ viewerId: meId, staff, targetId, friendIds, blocks })) return null;
  if (!(await hasTracker(targetId))) return null;

  const { monday, sunday } = weekOf(today);
  const [names, clubIds, logs] = await Promise.all([
    namesOf(admin, [targetId]),
    clubIdsOf(admin, targetId),
    admin
      .from("elite_training_logs")
      .select("minutes")
      .eq("profile_id", targetId)
      .eq("kind", "training")
      .gte("trained_on", monday)
      .lte("trained_on", sunday),
  ]);
  const clubs: string[] = [];
  for (const id of clubIds) {
    const club = await clubById(admin, id);
    if (club && !club.archived_at) clubs.push(club.name);
  }
  const name = names.get(targetId) ?? "A teammate";
  return {
    id: targetId,
    name,
    initials: initialsOf(name),
    clubs,
    weekMinutes: ((logs.data as { minutes: number }[] | null) ?? []).reduce((s, l) => s + l.minutes, 0),
    you,
  };
}
