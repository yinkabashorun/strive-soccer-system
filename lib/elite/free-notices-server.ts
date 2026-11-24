// The free app's notifications, sent (078). The rules are pure in
// free-notices.ts; this file reads what they need, claims, then sends.
// Every send is claimed first in elite_free_notices: only the caller whose
// insert succeeds sends, so a retry or a second request never sends twice.
// Best effort everywhere: a notice that cannot go never fails a post or
// props.
import { createServiceClient } from "./supabase/server";
import { notifyProfile } from "./notify";
import { isPushConfigured } from "./push";
import { isNativePushConfigured } from "./apns";
import { clubPlanNotice, friendPostNotice, propsNotice } from "./notices";
import { claimOutcome, maySend } from "./announce";
import { blocksWith, friendIdsOf, namesOf, type Admin } from "./tracker-server";
import { planById, teamRowsOf } from "./club-teams-server";
import { planDayAt, planWhat } from "./club-teams";
import {
  clubPlanReceivers,
  friendPostReceivers,
  isQuietTime,
  noticeKey,
  noticeName,
  nyClock,
  propsWithinDay,
  type NoticeKind,
} from "./free-notices";

async function claim(
  admin: Admin,
  profileId: string,
  kind: NoticeKind,
  key: { ny_date: string; ref: string },
  today: string
) {
  try {
    const { error } = await admin
      .from("elite_free_notices")
      .insert({ profile_id: profileId, kind, ny_date: key.ny_date, ref: key.ref, sent_on: today });
    return claimOutcome(error);
  } catch {
    return "failed" as const;
  }
}

function ready(): Admin | null {
  if (!isPushConfigured() && !isNativePushConfigured()) return null;
  if (isQuietTime(nyClock(new Date()))) return null; // 9:30 PM to 7 AM: dropped
  return createServiceClient();
}

async function withDevices(admin: Admin, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const [{ data: web }, { data: phones }] = await Promise.all([
    admin.from("elite_push_subscriptions").select("profile_id").in("profile_id", ids),
    admin.from("elite_native_push_tokens").select("profile_id").in("profile_id", ids),
  ]);
  return new Set(
    [...(web ?? []), ...(phones ?? [])].map((r) => r.profile_id as string | null).filter((x): x is string => Boolean(x))
  );
}

// A free player posted a photo: their accepted friends who have not
// posted today hear about it, once a day at most.
export async function noticeFriendPost(posterId: string, today: string): Promise<number> {
  const admin = ready();
  if (!admin) return 0;
  const friends = await friendIdsOf(admin, posterId);
  if (friends.length === 0) return 0;
  const [blocks, devices, { data: posted }] = await Promise.all([
    blocksWith(admin, posterId, friends),
    withDevices(admin, friends),
    admin
      .from("elite_training_logs")
      .select("profile_id")
      .in("profile_id", friends)
      .eq("trained_on", today)
      .not("photo_path", "is", null)
      .is("removed_at", null),
  ]);
  const receivers = friendPostReceivers({
    posterId,
    friends,
    blocks,
    withDevice: devices,
    postedToday: new Set(((posted as { profile_id: string }[] | null) ?? []).map((r) => r.profile_id)),
  });
  if (receivers.length === 0) return 0;
  const first = noticeName((await namesOf(admin, [posterId])).get(posterId) ?? "");
  let sent = 0;
  for (const id of receivers) {
    if (!maySend(await claim(admin, id, "friend_post", noticeKey("friend_post", { today }), today))) continue;
    const res = await notifyProfile(id, friendPostNotice({ first, nyDate: today }));
    if (res.pushed > 0) sent++;
  }
  return sent;
}

// A friend gave props on a post: its owner hears about it, once per post
// and three times a day at most.
export async function noticeProps(input: {
  giverId: string;
  ownerId: string;
  postId: string;
  postDay: string;
  today: string;
}): Promise<boolean> {
  if (input.giverId === input.ownerId) return false;
  const admin = ready();
  if (!admin) return false;
  if ((await withDevices(admin, [input.ownerId])).size === 0) return false;
  const key = noticeKey("props", { today: input.today, postId: input.postId, postDay: input.postDay });
  if (!maySend(await claim(admin, input.ownerId, "props", key, input.today))) return false;
  const { count } = await admin
    .from("elite_free_notices")
    .select("ref", { count: "exact", head: true })
    .eq("profile_id", input.ownerId)
    .eq("kind", "props")
    .eq("sent_on", input.today);
  if (!propsWithinDay(count ?? Number.POSITIVE_INFINITY)) return false;
  const first = noticeName((await namesOf(admin, [input.giverId])).get(input.giverId) ?? "");
  const res = await notifyProfile(input.ownerId, propsNotice({ first, postId: input.postId }));
  return res.pushed > 0;
}

// A club's training session was planned, or a game between two clubs is
// on (the other captain accepted): the members of the club(s) hear once.
// Each send is claimed first in elite_plan_notices (087), keyed (plan,
// player): a retry, or the same plan announced again, sends nothing, and
// so does a ledger that cannot be written (087 not applied). Never to the
// player who planned or accepted it, never at night, and only to a phone
// whose player left notifications on.
export async function noticeClubPlan(input: { planId: string; byId: string }): Promise<number> {
  const admin = ready();
  if (!admin) return 0;
  const plan = await planById(admin, input.planId);
  if (!plan || plan.status !== "on" || Date.parse(plan.starts_at) <= Date.now()) return 0;
  const clubIds = [plan.club_id, ...(plan.opponent_id ? [plan.opponent_id] : [])];
  const clubs = new Map((await teamRowsOf(admin, clubIds)).map((c) => [c.id, c.name]));
  const { data } = await admin.from("elite_tracker_club_members").select("club_id, profile_id").in("club_id", clubIds);
  const members = (data as { club_id: string; profile_id: string }[] | null) ?? [];
  const receivers = clubPlanReceivers({
    clubIds,
    members,
    byId: input.byId,
    withDevice: await withDevices(admin, [...new Set(members.map((m) => m.profile_id))]),
  });
  const when = planDayAt(plan.starts_at);
  let sent = 0;
  for (const r of receivers) {
    if (!maySend(await claimPlan(admin, plan.id, r.profileId))) continue;
    const other = clubIds.find((id) => id !== r.clubId) ?? null;
    const notice = clubPlanNotice({
      planId: plan.id,
      club: clubs.get(r.clubId) ?? "Your club",
      clubId: r.clubId,
      what: planWhat(plan, other ? clubs.get(other) ?? null : null),
      when,
    });
    const res = await notifyProfile(r.profileId, notice);
    if (res.pushed > 0) sent++;
  }
  return sent;
}

async function claimPlan(admin: Admin, planId: string, profileId: string) {
  try {
    const { error } = await admin.from("elite_plan_notices").insert({ plan_id: planId, profile_id: profileId });
    return claimOutcome(error);
  } catch {
    return "failed" as const;
  }
}
