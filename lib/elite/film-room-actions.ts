"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getViewer } from "./session";
import { createClient, createServiceClient } from "./supabase/server";
import { CLIP_BUCKET, ownsFilmRoomPath } from "./clips";
import type { Announcement } from "./film-room";
import {
  CHECKIN_SLOT_MINUTES,
  FILM_CLIPS_MAX,
  canCancelSlot,
  checkinAnnouncement,
  clipsDueIso,
  filmRoomAnnouncement,
  fmtWhen,
  generateSlots,
  isDay,
  isTime,
  monthKeyNY,
  nyLocalToIso,
} from "./film-room";
import { withoutPlayersOnBreak } from "./health";
import { sendPlayerOwnSMS, sendPlayerSMS } from "./sms";
import { sendPushToPlayer } from "./push";
import { sendCoachEmail, sendPlayerEmail } from "./email";
import { coachCallsUrl, filmRoomText, textCoaches } from "./coach-alerts";

// Weekly Film Room and monthly check-in calls (062, Nov 5 2026). Coach
// actions check the viewer is staff; member actions check the viewer owns
// the player. Writes go through the service client after those checks
// (members cannot read each other's rows), with the database's own
// constraints under them: five clips a room, one check-in a month.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://thestriveapp.com";

async function requireCoach() {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return null;
  return viewer;
}

function cleanZoom(raw: string): string {
  const t = (raw || "").trim();
  return /^https:\/\/.+/.test(t) ? t.slice(0, 500) : "";
}

function refresh() {
  revalidatePath("/coach/calls");
  revalidatePath("/film");
  revalidatePath("/dashboard");
}

// Tell every active member (not on a break) by a text to the parent and one to the player's own phone, push,
// email and the in-app bell. Best-effort per channel, never throws.
async function notifyMembers(
  db: SupabaseClient,
  kind: string,
  url: string,
  build: (p: { full_name: string; parent_name: string | null }) => Announcement
): Promise<{ members: number; texted: number; pushed: number }> {
  const { data } = await db
    .from("elite_players")
    .select("id, full_name, parent_name")
    .in("subscription_status", ["active", "trialing"]);
  const everyone = (data as { id: string; full_name: string; parent_name: string | null }[] | null) ?? [];
  const members = await withoutPlayersOnBreak(db, everyone);

  let texted = 0;
  let pushed = 0;
  await Promise.all(
    members.map(async (p) => {
      const m = build(p);
      await db
        .from("elite_notifications")
        .insert({ player_id: p.id, kind, title: m.inAppTitle, body: m.inAppBody })
        .then(() => undefined, () => undefined);
      const [sms, own, push] = await Promise.all([
        sendPlayerSMS(p.id, { event: kind, message: m.sms }).catch(() => false),
        sendPlayerOwnSMS(p.id, { event: kind, message: m.playerSms }).catch(() => false),
        sendPushToPlayer(p.id, { title: m.pushTitle, body: m.pushBody, url }).catch(() => ({ sent: 0 })),
        sendPlayerEmail(p.id, { event: kind, subject: m.inAppTitle, body: m.inAppBody }).catch(() => false),
      ]);
      if (sms) texted++;
      if (own) texted++;
      pushed += push.sent;
    })
  );
  return { members: members.length, texted, pushed };
}

// ------------------------------------------------------------------
// Coach: the weekly Film Room
// ------------------------------------------------------------------

export async function saveFilmRoom(input: {
  id?: string;
  day: string;
  time: string;
  zoom_url: string;
  topic: string;
}) {
  const viewer = await requireCoach();
  if (!viewer) return { ok: false as const, error: "Coaches only." };
  if (!isDay(input.day) || !isTime(input.time)) {
    return { ok: false as const, error: "Pick the day and the time." };
  }
  if (input.zoom_url.trim() && !cleanZoom(input.zoom_url)) {
    return { ok: false as const, error: "The Zoom link needs to start with https://" };
  }
  const db = createServiceClient();
  if (!db) return { ok: true as const };
  const row = {
    scheduled_at: nyLocalToIso(input.day, input.time),
    clips_due_at: clipsDueIso(input.day),
    zoom_url: cleanZoom(input.zoom_url),
    topic: input.topic.trim().slice(0, 140),
  };
  // A new Film Room is announced the moment it is saved (Coach Yinka,
  // Nov 5 2026: "notifications should only come when I save a film room").
  // Editing one later (the Zoom link, the topic) never sends anything.
  if (input.id) {
    const { error } = await db.from("elite_film_rooms").update(row).eq("id", input.id);
    if (error) {
      return {
        ok: false as const,
        error: error.code === "23505" ? "There is already a Film Room at that time." : "Couldn't save.",
      };
    }
    refresh();
    return { ok: true as const };
  }
  if (new Date(row.scheduled_at).getTime() < Date.now()) {
    return { ok: false as const, error: "That time has already passed. Pick the next one." };
  }
  const { data: room, error } = await db
    .from("elite_film_rooms")
    .insert({ ...row, created_by: viewer.profile.id, announced_at: new Date().toISOString() })
    .select("id, scheduled_at, clips_due_at")
    .single();
  if (error || !room) {
    return {
      ok: false as const,
      error:
        error?.code === "23505"
          ? "There is already a Film Room at that time."
          : "Couldn't save. Run database migration 062 first.",
    };
  }
  const counts = await notifyMembers(db, "film_room", "/film", (p) =>
    filmRoomAnnouncement({
      parentName: p.parent_name,
      playerName: p.full_name,
      scheduledAt: room.scheduled_at,
      clipsDueAt: room.clips_due_at,
      appUrl: APP_URL,
    })
  );
  refresh();
  return { ok: true as const, announced: counts };
}

export async function deleteFilmRoom(id: string) {
  if (!(await requireCoach())) return { ok: false as const };
  const db = createServiceClient();
  if (!db) return { ok: true as const };
  const { data: clips } = await db.from("elite_film_room_clips").select("clip_path").eq("film_room_id", id);
  const paths = ((clips as { clip_path: string }[] | null) ?? []).map((c) => c.clip_path);
  if (paths.length > 0) await db.storage.from(CLIP_BUCKET).remove(paths).catch(() => undefined);
  await db.from("elite_film_rooms").delete().eq("id", id);
  refresh();
  return { ok: true as const };
}

// ------------------------------------------------------------------
// Coach: monthly check-in days
// ------------------------------------------------------------------

export async function saveCheckinDay(input: {
  day: string;
  start: string;
  end: string;
  minutes?: number;
  zoom_url: string;
  coach_name: string;
}) {
  const viewer = await requireCoach();
  if (!viewer) return { ok: false as const, error: "Coaches only." };
  const minutes = input.minutes ?? CHECKIN_SLOT_MINUTES;
  const slots = generateSlots(input.day, input.start, input.end, minutes);
  if (slots.length === 0) {
    return { ok: false as const, error: "That window doesn't fit a call. Check the day, the times and the length." };
  }
  if (input.zoom_url.trim() && !cleanZoom(input.zoom_url)) {
    return { ok: false as const, error: "The Zoom link needs to start with https://" };
  }
  const db = createServiceClient();
  if (!db) return { ok: true as const };
  const { data: day, error } = await db
    .from("elite_checkin_days")
    .insert({
      starts_at: nyLocalToIso(input.day, input.start),
      ends_at: nyLocalToIso(input.day, input.end),
      slot_minutes: minutes,
      zoom_url: cleanZoom(input.zoom_url),
      coach_name: input.coach_name.trim().slice(0, 80) || "Coach Yinka and Coach Gary",
      created_by: viewer.profile.id,
    })
    .select("id")
    .single();
  if (error || !day) return { ok: false as const, error: "Couldn't save. Run database migration 062 first." };
  const { error: slotError } = await db
    .from("elite_checkin_slots")
    .insert(slots.map((starts_at) => ({ day_id: day.id, starts_at })));
  if (slotError) {
    await db.from("elite_checkin_days").delete().eq("id", day.id);
    return { ok: false as const, error: "Couldn't make the slots. Nothing was saved." };
  }
  refresh();
  return { ok: true as const };
}

// Give a booked slot back: delete the call it wrote and open the slot.
async function openSlot(db: SupabaseClient, slotId: string) {
  const { data: slot } = await db.from("elite_checkin_slots").select("call_id").eq("id", slotId).maybeSingle();
  if (slot?.call_id) await db.from("elite_coaching_calls").delete().eq("id", slot.call_id);
  await db
    .from("elite_checkin_slots")
    .update({ player_id: null, booked_at: null, month_key: null, call_id: null })
    .eq("id", slotId);
}

export async function deleteCheckinDay(id: string) {
  if (!(await requireCoach())) return { ok: false as const };
  const db = createServiceClient();
  if (!db) return { ok: true as const };
  const { data: slots } = await db.from("elite_checkin_slots").select("call_id").eq("day_id", id);
  const callIds = ((slots as { call_id: string | null }[] | null) ?? []).map((s) => s.call_id).filter(Boolean) as string[];
  if (callIds.length > 0) await db.from("elite_coaching_calls").delete().in("id", callIds);
  await db.from("elite_checkin_days").delete().eq("id", id);
  refresh();
  return { ok: true as const };
}

export async function releaseCheckinSlot(slotId: string) {
  if (!(await requireCoach())) return { ok: false as const };
  const db = createServiceClient();
  if (!db) return { ok: true as const };
  await openSlot(db, slotId);
  refresh();
  return { ok: true as const };
}

export async function announceCheckinDay(id: string, again = false) {
  if (!(await requireCoach())) return { ok: false as const, error: "Coaches only." };
  const db = createServiceClient();
  if (!db) return { ok: true as const, members: 0, texted: 0, pushed: 0 };
  const { data: day } = await db.from("elite_checkin_days").select("*").eq("id", id).maybeSingle();
  if (!day) return { ok: false as const, error: "That day is gone." };
  if (day.announced_at && !again) return { ok: false as const, error: "Already announced." };
  if (new Date(day.starts_at).getTime() < Date.now()) {
    return { ok: false as const, error: "That day has already happened." };
  }
  await db.from("elite_checkin_days").update({ announced_at: day.announced_at ?? new Date().toISOString() }).eq("id", id);
  const counts = await notifyMembers(db, "checkin_open", "/dashboard", (p) =>
    checkinAnnouncement({
      parentName: p.parent_name,
      playerName: p.full_name,
      startsAt: day.starts_at,
      endsAt: day.ends_at,
      minutes: day.slot_minutes,
      appUrl: APP_URL,
    })
  );
  refresh();
  return { ok: true as const, ...counts };
}

// ------------------------------------------------------------------
// Member: Film Room clips
// ------------------------------------------------------------------

// The clip is already in the player's own folder of the private bucket
// (uploaded from the browser, storage RLS, 062). Record it against the
// room. Five at most, held by the database.
export async function recordFilmRoomClip(input: { roomId: string; path: string }) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const, error: "Sign in first." };
  if (viewer.demo) return { ok: true as const };
  if (!ownsFilmRoomPath(input.path, viewer.playerId, input.roomId)) {
    return { ok: false as const, error: "That clip isn't yours." };
  }
  const db = createServiceClient();
  const supabase = createClient();
  if (!db || !supabase) return { ok: true as const };
  const { data: room } = await db
    .from("elite_film_rooms")
    .select("id, scheduled_at, announced_at")
    .eq("id", input.roomId)
    .maybeSingle();
  if (!room?.announced_at) return { ok: false as const, error: "That Film Room isn't open for clips." };
  if (new Date(room.scheduled_at).getTime() < Date.now()) {
    return { ok: false as const, error: "That Film Room has already happened." };
  }
  const { error } = await supabase
    .from("elite_film_room_clips")
    .insert({ film_room_id: input.roomId, player_id: viewer.playerId, clip_path: input.path });
  if (error) {
    return {
      ok: false as const,
      error:
        error.code === "23514"
          ? `That's ${FILM_CLIPS_MAX} clips already. Remove one to add another.`
          : "Couldn't add the clip. Try again.",
    };
  }
  refresh();
  revalidatePath(`/coach/players/${viewer.playerId}`);
  return { ok: true as const };
}

// One text to the coaches per batch a member adds (the uploader calls this
// once after its clips are in, so five clips are one text, not five).
export async function notifyCoachesOfFilmRoomClips(input: { roomId: string; added: number }) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const };
  if (viewer.demo) return { ok: true as const };
  const db = createServiceClient();
  if (!db) return { ok: true as const };
  const added = Math.max(0, Math.min(FILM_CLIPS_MAX, Math.floor(input.added)));
  if (added === 0) return { ok: true as const };
  const [{ data: room }, { count }] = await Promise.all([
    db.from("elite_film_rooms").select("scheduled_at").eq("id", input.roomId).maybeSingle(),
    db
      .from("elite_film_room_clips")
      .select("id", { count: "exact", head: true })
      .eq("film_room_id", input.roomId)
      .eq("player_id", viewer.playerId),
  ]);
  if (!room) return { ok: false as const };
  const day = new Date(room.scheduled_at).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  });
  await textCoaches(
    filmRoomText(viewer.profile.full_name, added, count ?? added, day, coachCallsUrl())
  ).catch(() => 0);
  return { ok: true as const };
}

export async function removeFilmRoomClip(clipId: string) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const, error: "Sign in first." };
  if (viewer.demo) return { ok: true as const };
  const db = createServiceClient();
  if (!db) return { ok: true as const };
  const { data: clip } = await db
    .from("elite_film_room_clips")
    .select("id, clip_path, player_id, film_room_id")
    .eq("id", clipId)
    .eq("player_id", viewer.playerId)
    .maybeSingle();
  if (!clip) return { ok: false as const, error: "That clip isn't yours." };
  const { data: room } = await db.from("elite_film_rooms").select("scheduled_at").eq("id", clip.film_room_id).maybeSingle();
  if (room && new Date(room.scheduled_at).getTime() < Date.now()) {
    return { ok: false as const, error: "That Film Room has already happened." };
  }
  await db.from("elite_film_room_clips").delete().eq("id", clipId);
  await db.storage.from(CLIP_BUCKET).remove([clip.clip_path]).catch(() => undefined);
  refresh();
  return { ok: true as const };
}

// ------------------------------------------------------------------
// Member: monthly check-in call
// ------------------------------------------------------------------

export async function bookCheckinSlot(slotId: string) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const, error: "Sign in first." };
  if (viewer.demo) return { ok: true as const };
  const db = createServiceClient();
  if (!db) return { ok: true as const };

  const { data: slot } = await db.from("elite_checkin_slots").select("*").eq("id", slotId).maybeSingle();
  if (!slot) return { ok: false as const, error: "That time is gone." };
  if (new Date(slot.starts_at).getTime() <= Date.now()) {
    return { ok: false as const, error: "That time has passed." };
  }
  const { data: day } = await db.from("elite_checkin_days").select("*").eq("id", slot.day_id).maybeSingle();
  if (!day) return { ok: false as const, error: "That day is gone." };

  // Claim the slot only while it is still open; the unique index holds
  // one call a month per player.
  const { data: claimed, error } = await db
    .from("elite_checkin_slots")
    .update({
      player_id: viewer.playerId,
      booked_at: new Date().toISOString(),
      month_key: monthKeyNY(slot.starts_at),
    })
    .eq("id", slotId)
    .is("player_id", null)
    .select("id")
    .maybeSingle();
  if (error) {
    return {
      ok: false as const,
      error:
        error.code === "23505"
          ? "You already have a call that month. Give that one back first to move it."
          : "Couldn't book that time. Try again.",
    };
  }
  if (!claimed) return { ok: false as const, error: "Someone just took that time. Pick another." };

  // The call itself (029): the dashboard card, the Join link and the
  // post-call note that steers the plan all read this row.
  const { data: call, error: callError } = await db
    .from("elite_coaching_calls")
    .insert({
      player_id: viewer.playerId,
      scheduled_at: slot.starts_at,
      join_url: day.zoom_url || "",
      coach_name: day.coach_name || "Coach Yinka and Coach Gary",
    })
    .select("id")
    .single();
  if (callError || !call) {
    await db
      .from("elite_checkin_slots")
      .update({ player_id: null, booked_at: null, month_key: null })
      .eq("id", slotId);
    return { ok: false as const, error: "Couldn't book that time. Try again." };
  }
  await db.from("elite_checkin_slots").update({ call_id: call.id }).eq("id", slotId);

  await sendCoachEmail(viewer.playerId, {
    event: "checkin_booked",
    subject: `${viewer.profile.full_name} booked a check-in call`,
    body: `${viewer.profile.full_name} booked a monthly check-in for ${fmtWhen(slot.starts_at)}.`,
  }).catch(() => undefined);

  refresh();
  revalidatePath(`/coach/players/${viewer.playerId}`);
  return { ok: true as const };
}

export async function cancelCheckinSlot(slotId: string) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const, error: "Sign in first." };
  if (viewer.demo) return { ok: true as const };
  const db = createServiceClient();
  if (!db) return { ok: true as const };
  const { data: slot } = await db
    .from("elite_checkin_slots")
    .select("id, starts_at, player_id")
    .eq("id", slotId)
    .eq("player_id", viewer.playerId)
    .maybeSingle();
  if (!slot) return { ok: false as const, error: "That call isn't yours." };
  if (!canCancelSlot(slot.starts_at)) {
    return { ok: false as const, error: "Calls can be given back up to 24 hours before. Message your coach." };
  }
  await openSlot(db, slotId);
  refresh();
  revalidatePath(`/coach/players/${viewer.playerId}`);
  return { ok: true as const };
}
