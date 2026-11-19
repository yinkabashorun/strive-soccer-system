"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "./supabase/server";
import { getViewer } from "./session";
import { nyToday } from "./time";
import { APP_URL } from "./app-url";
import { textCoaches } from "./coach-alerts";
import {
  clubById,
  clubIdsOf,
  getTracker,
  joinClub,
  joinClubByCode,
  makeFriends,
  membersOf,
  newClub,
  postForViewer,
  profileFor,
  trackerFor,
} from "./tracker-server";
import { DEMO_ASK, DEMO_CLUB_ASK, demoClubs, readDemoState, writeDemoState } from "./tracker-demo";
import {
  BIRTH_REQUIRED_MESSAGE,
  BLOCKED_LINK_MESSAGE,
  CLUB_CAP_MESSAGE,
  CLUB_NAME_MESSAGE,
  CLUB_REFUSED,
  FREE_HOME,
  FREE_WEEK,
  GYM_REFUSED_MESSAGE,
  JOIN_AGE_COOKIE,
  POST_BUCKET,
  cleanBirth,
  cleanClubCode,
  cleanClubName,
  clubReportText,
  isCaptain,
  mayRemoveMember,
  mayStartClub,
  nextCaptain,
  cleanKind,
  cleanPlanDays,
  cleanReason,
  cleanReferralCode,
  cleanTarget,
  friendPair,
  mayGiveProps,
  mayLog,
  mayViewPhoto,
  oldEnough,
  ownsPostPath,
  reportText,
  shortName,
  validateMinutes,
  validateQuiz,
  type Kind,
  type Profile,
  type Season,
} from "./tracker";

// The free app: writing it (migration 069). Every write goes through
// here or through the post route: the signed-in viewer is resolved first,
// the row touched is always their own (the profile id comes from the
// session, never from the browser), and only then is the service client
// used. The example account (no database) answers ok and keeps what it
// did in a cookie only.
//
// Nothing here sends anything to a player: no texts, no pushes, no notes.
// The texts in this file go to the coaches, once, when a post or a club
// name is first reported.

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const OFFLINE = "We could not reach the server. Try again in a minute.";
const PICK_A_DAY = "Pick at least one day.";
const NOT_THERE = "That post is not there any more.";

type Admin = NonNullable<ReturnType<typeof createServiceClient>>;

function touch() {
  revalidatePath(FREE_HOME);
  revalidatePath(FREE_WEEK);
}

// The signed-in free account, or why not.
type Owner =
  | { kind: "no"; error: string }
  | { kind: "demo"; grade: string | null }
  | { kind: "ok"; admin: Admin; profileId: string; grade: string | null };

async function owner(): Promise<Owner> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player") return { kind: "no", error: "Sign in first." };
  // The example account: nothing is saved, but the same rules apply.
  if (viewer.demo) return { kind: "demo", grade: (await trackerFor(viewer))?.grade ?? null };
  const admin = createServiceClient();
  if (!admin) return { kind: "demo", grade: null };
  const tracker = await getTracker(viewer.profile.id);
  if (!tracker) return { kind: "no", error: "Sign in first." };
  return { kind: "ok", admin, profileId: viewer.profile.id, grade: tracker.grade };
}

// ---- Joining ----------------------------------------------------------

// The first thing the join form asks: the month and year the player was
// born. Under 13, the answer is no, and a flag is left in this browser
// for the rest of the visit so the form cannot simply be filled in again
// with another date (the join route refuses while the flag is there).
// The date itself is not kept anywhere.
export async function checkJoinAge(
  month: number,
  year: number
): Promise<{ ok: true; allowed: boolean } | Fail> {
  const today = nyToday();
  if (cookies().get(JOIN_AGE_COOKIE)) return { ok: true, allowed: false };
  const birth = cleanBirth({ month, year }, today);
  if (!birth) return fail(BIRTH_REQUIRED_MESSAGE);
  if (oldEnough(birth, today)) return { ok: true, allowed: true };
  cookies().set(JOIN_AGE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // no maxAge: it lasts as long as this visit does
  });
  return { ok: true, allowed: false };
}

// ---- The set-up -------------------------------------------------------

// Save the set-up: the four quiz answers, the weekly target the player
// chose, and the days they will train.
export async function saveQuiz(input: {
  grade: string;
  level: string;
  season: string;
  goal: string;
  target: number;
  days: number[];
}): Promise<{ ok: true } | Fail> {
  const answers = validateQuiz(input);
  const target = cleanTarget(input.target);
  if (!answers || target === null) return fail("Answer all four questions, then pick a target.");
  const days = cleanPlanDays(input.days);
  if (!days) return fail(PICK_A_DAY);
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    writeDemoState({ quiz: { ...answers, target }, days });
    return { ok: true };
  }
  const { error } = await o.admin
    .from("elite_trackers")
    .update({
      grade: answers.grade,
      level: answers.level,
      season: answers.season,
      goal: answers.goal,
      target_minutes: target,
      plan_days: days,
      quiz: answers,
      quiz_done_at: new Date().toISOString(),
    })
    .eq("profile_id", o.profileId);
  if (error) return fail(OFFLINE);
  touch();
  return { ok: true };
}

// Change the days of the week the player plans to train.
export async function setPlanDays(input: number[]): Promise<{ ok: true } | Fail> {
  const days = cleanPlanDays(input);
  if (!days) return fail(PICK_A_DAY);
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    writeDemoState({ days });
    return { ok: true };
  }
  const { error } = await o.admin
    .from("elite_trackers")
    .update({ plan_days: days })
    .eq("profile_id", o.profileId);
  if (error) return fail(OFFLINE);
  touch();
  return { ok: true };
}

// ---- Logging ----------------------------------------------------------

// "Log it without a photo": minutes for today (New York date), as
// training or as gym work, kept to the player's own week. A post with a
// photo goes through the post route instead. Gym is for a player in high
// school or older only (mayLog, read from the grade on their own saved
// row); anyone else asking to log gym is refused before anything is
// written.
export async function logTraining(
  minutesInput: number,
  kindInput: string = "training"
): Promise<{ ok: true; id: string; trained_on: string; minutes: number; kind: Kind } | Fail> {
  const minutes = validateMinutes(minutesInput);
  const kind = cleanKind(kindInput);
  if (minutes === null || kind === null) return fail("That is not something we can log.");
  const trained_on = nyToday();
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (!mayLog(kind, o.grade)) return fail(GYM_REFUSED_MESSAGE);
  if (o.kind === "demo") {
    const id = `demo-today-${Date.now()}`;
    const kept = (readDemoState().today ?? []).filter((e) => e.day === trained_on).slice(-5);
    writeDemoState({
      today: [...kept, { id, day: trained_on, minutes, kind, caption: null, photo: false, at: new Date().toISOString() }],
    });
    return { ok: true, id, trained_on, minutes, kind };
  }
  const { data, error } = await o.admin
    .from("elite_training_logs")
    .insert({ profile_id: o.profileId, trained_on, minutes, kind })
    .select("id")
    .single();
  if (error || !data) return fail(OFFLINE);
  touch();
  return { ok: true, id: data.id as string, trained_on, minutes, kind };
}

// The delete on an entry or on your own post: only ever the player's own
// row. A post's photo is deleted with it.
export async function deleteLog(id: string): Promise<{ ok: true } | Fail> {
  if (typeof id !== "string" || !id) return fail("Nothing to delete.");
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    writeDemoState({ today: (readDemoState().today ?? []).filter((e) => e.id !== id) });
    return { ok: true };
  }
  const { data: row } = await o.admin
    .from("elite_training_logs")
    .select("photo_path")
    .eq("id", id)
    .eq("profile_id", o.profileId)
    .maybeSingle();
  const { error } = await o.admin
    .from("elite_training_logs")
    .delete()
    .eq("id", id)
    .eq("profile_id", o.profileId);
  if (error) return fail(OFFLINE);
  const path = (row?.photo_path as string | null) ?? null;
  if (path && ownsPostPath(path, o.profileId)) {
    await o.admin.storage.from(POST_BUCKET).remove([path]).catch(() => undefined);
  }
  touch();
  return { ok: true };
}

// ---- Friends ----------------------------------------------------------

// "Yes" on the sheet a signed-in player sees after opening a teammate's
// link. The teammate is found from the link's code; the other side of the
// pair is always the signed-in player.
export async function confirmFriend(codeInput: string): Promise<{ ok: true } | Fail> {
  const code = cleanReferralCode(codeInput);
  if (!code) return fail("That link is not one of ours.");
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    if (code === DEMO_ASK.code) writeDemoState({ added: true });
    return { ok: true };
  }
  const { data: other } = await o.admin
    .from("elite_trackers")
    .select("profile_id")
    .eq("referral_code", code)
    .maybeSingle();
  const otherId = other?.profile_id as string | undefined;
  if (!otherId || otherId === o.profileId) return fail("That link is not one of ours.");
  const made = await makeFriends(o.profileId, otherId);
  if (made === "blocked") return fail(BLOCKED_LINK_MESSAGE);
  if (made !== "ok") return fail(OFFLINE);
  touch();
  return { ok: true };
}

// Take a friend off: the pair is removed, for both of them. Only a pair
// the signed-in player is one side of can be named.
export async function removeFriend(friendId: string): Promise<{ ok: true } | Fail> {
  if (typeof friendId !== "string" || !friendId) return fail("Nothing to remove.");
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    if (friendId === DEMO_ASK.id) {
      writeDemoState({ added: false });
    } else {
      writeDemoState({ removed: [...new Set([...(readDemoState().removed ?? []), friendId])] });
    }
    return { ok: true };
  }
  const pair = friendPair(o.profileId, friendId);
  if (!pair) return fail("Nothing to remove.");
  const { error } = await o.admin
    .from("elite_tracker_friends")
    .delete()
    .eq("a", pair.a)
    .eq("b", pair.b);
  if (error) return fail(OFFLINE);
  touch();
  return { ok: true };
}

// Block a friend: the friendship ends for both, each stops seeing
// anything of the other, and the link cannot make them friends again
// while the block stands. Only someone who is a friend right now can be
// blocked (nobody else is ever shown to a player). They are not told.
export async function blockPlayer(friendId: string): Promise<{ ok: true } | Fail> {
  if (typeof friendId !== "string" || !friendId) return fail("Nobody to block.");
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    writeDemoState({ blocked: [...new Set([...(readDemoState().blocked ?? []), friendId])] });
    return { ok: true };
  }
  const pair = friendPair(o.profileId, friendId);
  if (!pair) return fail("Nobody to block.");
  const { data: friends } = await o.admin
    .from("elite_tracker_friends")
    .select("a")
    .eq("a", pair.a)
    .eq("b", pair.b)
    .maybeSingle();
  if (!friends) return fail("Nobody to block.");
  const { error } = await o.admin
    .from("elite_tracker_blocks")
    .upsert({ blocker: o.profileId, blocked: friendId }, { onConflict: "blocker,blocked", ignoreDuplicates: true });
  if (error) return fail(OFFLINE);
  await o.admin.from("elite_tracker_friends").delete().eq("a", pair.a).eq("b", pair.b);
  touch();
  return { ok: true };
}

// Take a block back, from Account. It does not bring the friendship
// back: that takes the link again.
export async function unblockPlayer(blockedId: string): Promise<{ ok: true } | Fail> {
  if (typeof blockedId !== "string" || !blockedId) return fail("Nobody to unblock.");
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    writeDemoState({ blocked: (readDemoState().blocked ?? []).filter((id) => id !== blockedId) });
    return { ok: true };
  }
  const { error } = await o.admin
    .from("elite_tracker_blocks")
    .delete()
    .eq("blocker", o.profileId)
    .eq("blocked", blockedId);
  if (error) return fail(OFFLINE);
  revalidatePath("/account");
  return { ok: true };
}

// ---- A friend's post --------------------------------------------------

// Props: one tap gives them, another takes them back. Only on a friend's
// post this player can see right now (mayGiveProps): never their own,
// never a locked one.
export async function toggleProps(logId: string): Promise<{ ok: true; propped: boolean } | Fail> {
  if (typeof logId !== "string" || !logId) return fail(NOT_THERE);
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    const given = new Set(readDemoState().props ?? []);
    const propped = !given.has(logId);
    if (propped) given.add(logId);
    else given.delete(logId);
    writeDemoState({ props: [...given] });
    return { ok: true, propped };
  }
  const today = nyToday();
  const found = await postForViewer(o.admin, o.profileId, logId, today);
  if (!found || !mayGiveProps(found.post, found.viewer, today)) return fail(NOT_THERE);
  const { data: had } = await o.admin
    .from("elite_log_props")
    .select("log_id")
    .eq("log_id", logId)
    .eq("profile_id", o.profileId)
    .maybeSingle();
  const { error } = had
    ? await o.admin.from("elite_log_props").delete().eq("log_id", logId).eq("profile_id", o.profileId)
    : await o.admin.from("elite_log_props").insert({ log_id: logId, profile_id: o.profileId });
  if (error) return fail(OFFLINE);
  return { ok: true, propped: !had };
}

// Report a friend's post. It leaves the reporter's feed at once and waits
// for a coach at /coach/free. The coaches get one text for a post, the
// first time it is reported; the player who posted it is not told.
export async function reportPost(logId: string, reasonInput: string): Promise<{ ok: true } | Fail> {
  const reason = cleanReason(reasonInput);
  if (typeof logId !== "string" || !logId || !reason) return fail("Pick what is wrong with it.");
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    writeDemoState({ reported: [...new Set([...(readDemoState().reported ?? []), logId])] });
    return { ok: true };
  }
  const today = nyToday();
  const found = await postForViewer(o.admin, o.profileId, logId, today);
  if (!found || found.post.profile_id === o.profileId || !mayViewPhoto(found.post, found.viewer, today)) {
    return fail(NOT_THERE);
  }
  const { count } = await o.admin
    .from("elite_post_reports")
    .select("id", { count: "exact", head: true })
    .eq("log_id", logId);
  const { error } = await o.admin
    .from("elite_post_reports")
    .upsert({ log_id: logId, reporter_id: o.profileId, reason }, { onConflict: "log_id,reporter_id", ignoreDuplicates: true });
  if (error) return fail(OFFLINE);
  if (!count) {
    const { data: poster } = await o.admin
      .from("elite_profiles")
      .select("full_name")
      .eq("id", found.post.profile_id)
      .maybeSingle();
    const name = shortName((poster?.full_name as string) ?? "");
    await textCoaches(reportText(name, `${APP_URL}/coach/free`)).catch(() => 0);
  }
  touch();
  return { ok: true };
}

// ---- Clubs -------------------------------------------------------------

type ClubOk = { ok: true; code: string };
const NOT_A_CLUB = "That club is not there any more.";

// "Yes" on "Join <club>?", from a club's link opened while signed in.
export async function confirmClub(codeInput: string): Promise<{ ok: true } | Fail> {
  const code = cleanClubCode(codeInput);
  if (!code) return fail("That link is not one of ours.");
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    const mine = demoClubs();
    if (code === DEMO_CLUB_ASK.code && !mine.some((c) => c.id === DEMO_CLUB_ASK.id)) {
      if (!mayStartClub(mine.length)) return fail(CLUB_CAP_MESSAGE);
      writeDemoState({ clubs: [...mine, DEMO_CLUB_ASK] });
    }
    return { ok: true };
  }
  const res = await joinClubByCode(o.profileId, code);
  if (res === "none") return fail("That link is not one of ours.");
  if (res === "error") return fail(OFFLINE);
  if (res !== "ok" && res !== "already") return fail(CLUB_REFUSED[res]);
  touch();
  return { ok: true };
}

// "Start a club": any free player, up to their cap. They are its captain
// and its first member, and get its link to send.
export async function startClub(nameInput: string): Promise<ClubOk | Fail> {
  const name = cleanClubName(nameInput);
  if (!name) return fail(CLUB_NAME_MESSAGE);
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    const mine = demoClubs();
    if (!mayStartClub(mine.length)) return fail(CLUB_CAP_MESSAGE);
    const code = "NEWCLUBX";
    writeDemoState({ clubs: [...mine, { id: `demo-club-new-${Date.now()}`, name, code, captain: true, kind: "player" }] });
    return { ok: true, code };
  }
  if (!mayStartClub((await clubIdsOf(o.admin, o.profileId)).length)) return fail(CLUB_CAP_MESSAGE);
  const club = await newClub({ name, kind: "player", captainId: o.profileId, createdBy: o.profileId });
  if (!club) return fail(OFFLINE);
  if ((await joinClub(o.profileId, club)) !== "ok") {
    await o.admin.from("elite_tracker_clubs").delete().eq("id", club.id);
    return fail(OFFLINE);
  }
  touch();
  return { ok: true, code: club.join_code };
}

// Leave a club. Friendships made through it stay as they are: a block is
// the way to cut one. A captain who leaves hands the club to the member
// who has been on it longest; with nobody left, the club ends.
export async function leaveClub(clubId: string): Promise<{ ok: true } | Fail> {
  if (typeof clubId !== "string" || !clubId) return fail(NOT_A_CLUB);
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") {
    writeDemoState({ clubs: demoClubs().filter((c) => c.id !== clubId) });
    return { ok: true };
  }
  const club = await clubById(o.admin, clubId);
  if (!club) return fail(NOT_A_CLUB);
  const members = await membersOf(o.admin, clubId);
  if (!members.some((m) => m.profile_id === o.profileId)) return fail(NOT_A_CLUB);
  const { error } = await o.admin
    .from("elite_tracker_club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("profile_id", o.profileId);
  if (error) return fail(OFFLINE);
  if (club.captain_id === o.profileId) {
    const next = nextCaptain(members, o.profileId);
    await o.admin
      .from("elite_tracker_clubs")
      .update(next ? { captain_id: next } : { captain_id: null, archived_at: new Date().toISOString() })
      .eq("id", clubId);
  }
  touch();
  return { ok: true };
}

// The captain's three: rename, take a member off, end the club.
async function captainOf(clubId: string): Promise<{ o: Extract<Owner, { kind: "ok" }>; club: NonNullable<Awaited<ReturnType<typeof clubById>>> } | Fail | "demo"> {
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return "demo";
  const club = typeof clubId === "string" && clubId ? await clubById(o.admin, clubId) : null;
  if (!club) return fail(NOT_A_CLUB);
  if (!isCaptain(club, o.profileId)) return fail("Only the club's captain can do that.");
  return { o, club };
}

export async function renameMyClub(clubId: string, nameInput: string): Promise<{ ok: true } | Fail> {
  const name = cleanClubName(nameInput);
  if (!name) return fail(CLUB_NAME_MESSAGE);
  const c = await captainOf(clubId);
  if (c === "demo") {
    writeDemoState({ clubs: demoClubs().map((x) => (x.id === clubId && x.captain ? { ...x, name } : x)) });
    return { ok: true };
  }
  if ("ok" in c) return c;
  const { error } = await c.o.admin.from("elite_tracker_clubs").update({ name }).eq("id", clubId);
  if (error) return fail(OFFLINE);
  touch();
  return { ok: true };
}

// Take a member off the club. Their friendships stay, as when they leave.
export async function removeClubMember(clubId: string, memberId: string): Promise<{ ok: true } | Fail> {
  const c = await captainOf(clubId);
  if (c === "demo") return { ok: true };
  if ("ok" in c) return c;
  if (typeof memberId !== "string" || !mayRemoveMember(c.club, c.o.profileId, memberId)) {
    return fail("Only the club's captain can do that.");
  }
  const { error } = await c.o.admin
    .from("elite_tracker_club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("profile_id", memberId);
  if (error) return fail(OFFLINE);
  touch();
  return { ok: true };
}

// End the club: no new joins; the roster stays.
export async function endMyClub(clubId: string): Promise<{ ok: true } | Fail> {
  const c = await captainOf(clubId);
  if (c === "demo") {
    writeDemoState({ clubs: demoClubs().filter((x) => !(x.id === clubId && x.captain)) });
    return { ok: true };
  }
  if ("ok" in c) return c;
  const { error } = await c.o.admin
    .from("elite_tracker_clubs")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", clubId);
  if (error) return fail(OFFLINE);
  touch();
  return { ok: true };
}

// Report a club's name, from its roster, by a member who is not its
// captain. It waits in the coach queue; the coaches get one text a club.
export async function reportClub(clubId: string): Promise<{ ok: true } | Fail> {
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true };
  const club = typeof clubId === "string" && clubId ? await clubById(o.admin, clubId) : null;
  if (!club) return fail(NOT_A_CLUB);
  const members = await membersOf(o.admin, clubId);
  if (!members.some((m) => m.profile_id === o.profileId) || club.captain_id === o.profileId) return fail(NOT_A_CLUB);
  const { count } = await o.admin
    .from("elite_club_reports")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId);
  const { error } = await o.admin
    .from("elite_club_reports")
    .upsert({ club_id: clubId, reporter_id: o.profileId }, { onConflict: "club_id,reporter_id", ignoreDuplicates: true });
  if (error) return fail(OFFLINE);
  if (!count) await textCoaches(clubReportText(club.name, `${APP_URL}/coach/free`)).catch(() => 0);
  return { ok: true };
}

// ---- Profiles ----------------------------------------------------------

// A player's profile, for the sheet that opens from a face, a name on the
// board or a post. Only the player, their friends and coaches get one.
export async function loadProfile(targetId: string): Promise<Profile | null> {
  if (typeof targetId !== "string" || !targetId) return null;
  const viewer = await getViewer();
  if (!viewer) return null;
  if (viewer.role === "player" && !viewer.demo && !(await getTracker(viewer.profile.id))) return null;
  return profileFor(viewer, targetId, nyToday());
}

// ---- Coach side (/coach/free) -----------------------------------------

type Coach =
  | { kind: "no" }
  | { kind: "demo" }
  | { kind: "ok"; admin: Admin; profileId: string };

async function coach(): Promise<Coach> {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return { kind: "no" };
  if (viewer.demo) return { kind: "demo" };
  const admin = createServiceClient();
  if (!admin) return { kind: "demo" };
  return { kind: "ok", admin, profileId: viewer.profile.id };
}

// Open or close free sign-up for everyone.
export async function setFreeSignupOpen(open: boolean): Promise<{ ok: true } | Fail> {
  const c = await coach();
  if (c.kind === "no") return fail("Only a coach can change this.");
  if (c.kind === "demo") return { ok: true };
  const { error } = await c.admin
    .from("elite_settings")
    .upsert(
      { key: "free_signup_open", value: open === true, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) return fail(OFFLINE);
  revalidatePath("/coach/free");
  revalidatePath("/join");
  return { ok: true };
}

// Change the recommended weekly target for a season. `max` makes it a
// range ("6 to 12 hours"); null makes it a single number.
export async function saveTargetRow(input: {
  season: Season;
  minutes: number;
  max: number | null;
}): Promise<{ ok: true } | Fail> {
  if (input.season !== "in_season" && input.season !== "off_season") return fail("Pick a season.");
  const minutes = cleanTarget(input.minutes);
  const max = input.max === null ? null : cleanTarget(input.max);
  if (minutes === null) return fail("Enter the hours in half-hour steps, from 0.5 to 40.");
  if (input.max !== null && (max === null || max <= minutes)) {
    return fail("The top of the range has to be more than the bottom, in half-hour steps.");
  }
  const c = await coach();
  if (c.kind === "no") return fail("Only a coach can change this.");
  if (c.kind === "demo") return { ok: true };
  const { error } = await c.admin
    .from("elite_target_table")
    .upsert(
      { season: input.season, minutes, minutes_max: max, updated_at: new Date().toISOString() },
      { onConflict: "season" }
    );
  if (error) return fail(OFFLINE);
  revalidatePath("/coach/free");
  return { ok: true };
}

// Close every open report on a post with what was done about it.
async function closeReports(c: { admin: Admin; profileId: string }, logId: string, action: "removed" | "none") {
  return c.admin
    .from("elite_post_reports")
    .update({ resolved_at: new Date().toISOString(), resolved_by: c.profileId, action })
    .eq("log_id", logId)
    .is("resolved_at", null);
}

// "Remove the post": the post is marked taken down (when, and by which
// coach), its photo is deleted from storage, and its reports are closed.
// The minutes stay in the player's week. After this the post is shown to
// nobody.
export async function removePost(logId: string): Promise<{ ok: true } | Fail> {
  if (typeof logId !== "string" || !logId) return fail(NOT_THERE);
  const c = await coach();
  if (c.kind === "no") return fail("Only a coach can remove a post.");
  if (c.kind === "demo") return { ok: true };
  const { data: row } = await c.admin
    .from("elite_training_logs")
    .select("id, profile_id, photo_path")
    .eq("id", logId)
    .maybeSingle();
  if (!row) return fail(NOT_THERE);
  const { error } = await c.admin
    .from("elite_training_logs")
    .update({ removed_at: new Date().toISOString(), removed_by: c.profileId })
    .eq("id", logId);
  if (error) return fail(OFFLINE);
  const path = (row.photo_path as string | null) ?? null;
  if (path && ownsPostPath(path, row.profile_id as string)) {
    await c.admin.storage.from(POST_BUCKET).remove([path]).catch(() => undefined);
  }
  await closeReports(c, logId, "removed");
  revalidatePath("/coach/free");
  touch();
  return { ok: true };
}

// "No action": the reports are closed and the post stays up. It stays
// hidden from the players who reported it.
export async function dismissReports(logId: string): Promise<{ ok: true } | Fail> {
  if (typeof logId !== "string" || !logId) return fail(NOT_THERE);
  const c = await coach();
  if (c.kind === "no") return fail("Only a coach can do this.");
  if (c.kind === "demo") return { ok: true };
  const { error } = await closeReports(c, logId, "none");
  if (error) return fail(OFFLINE);
  revalidatePath("/coach/free");
  return { ok: true };
}

// ---- Coach side: clubs --------------------------------------------------

// A coach-made club (the Dec 19 5v5 ones): no captain, the coaches look
// after it here.
export async function createClub(nameInput: string): Promise<ClubOk | Fail> {
  const name = cleanClubName(nameInput);
  if (!name) return fail(CLUB_NAME_MESSAGE);
  const c = await coach();
  if (c.kind === "no") return fail("Only a coach can do this.");
  if (c.kind === "demo") return { ok: true, code: "NEWCLUBX" };
  const club = await newClub({ name, kind: "coach", captainId: null, createdBy: c.profileId });
  if (!club) return fail(OFFLINE);
  revalidatePath("/coach/free");
  return { ok: true, code: club.join_code };
}

async function closeClubReports(c: { admin: Admin; profileId: string }, clubId: string, action: "renamed" | "archived" | "none") {
  return c.admin
    .from("elite_club_reports")
    .update({ resolved_at: new Date().toISOString(), resolved_by: c.profileId, action })
    .eq("club_id", clubId)
    .is("resolved_at", null);
}

// A coach renames any club (a reported name, or a 5v5 club).
export async function renameClub(clubId: string, nameInput: string): Promise<{ ok: true } | Fail> {
  const name = cleanClubName(nameInput);
  if (!name) return fail(CLUB_NAME_MESSAGE);
  const c = await coach();
  if (c.kind === "no") return fail("Only a coach can do this.");
  if (c.kind === "demo") return { ok: true };
  const { error } = await c.admin.from("elite_tracker_clubs").update({ name }).eq("id", clubId);
  if (error) return fail(OFFLINE);
  await closeClubReports(c, clubId, "renamed");
  revalidatePath("/coach/free");
  return { ok: true };
}

// A coach archives any club: no new joins, the roster stays.
export async function archiveClub(clubId: string): Promise<{ ok: true } | Fail> {
  const c = await coach();
  if (c.kind === "no") return fail("Only a coach can do this.");
  if (c.kind === "demo") return { ok: true };
  const { error } = await c.admin
    .from("elite_tracker_clubs")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", clubId);
  if (error) return fail(OFFLINE);
  await closeClubReports(c, clubId, "archived");
  revalidatePath("/coach/free");
  return { ok: true };
}

export async function dismissClubReports(clubId: string): Promise<{ ok: true } | Fail> {
  const c = await coach();
  if (c.kind === "no") return fail("Only a coach can do this.");
  if (c.kind === "demo") return { ok: true };
  const { error } = await closeClubReports(c, clubId, "none");
  if (error) return fail(OFFLINE);
  revalidatePath("/coach/free");
  return { ok: true };
}
