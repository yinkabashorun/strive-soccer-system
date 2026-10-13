"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "./supabase/server";
import { getViewer } from "./session";
import { maybeAwardAchievements } from "./achievements";
import { sendCoachEmail } from "./email";
import { normalizePhone } from "./sms";
import { liveWeekFor, monthFromWeek } from "./time";
import { CLIP_BUCKET, ownsClipPath, ownsProgressPath } from "./clips";
import { getBenchmark, getHomework, getProgressVideos } from "./data";
import { previousProgressVideo, progressVideoDue } from "./progress-video";
import { sendPlayerSMS } from "./sms";
import type { ProgressMetric, TrainingLoad, TrainingSpace } from "./types";
import { TRAINING_LOADS } from "./training";

export type OnboardingInput = {
  age: number;
  position: string;
  level: string;
  club: string;
  dominant_foot: string;
  gender: "boy" | "girl";
  goals: string[];
  weaknesses: string[];
  self_assessment: Partial<Record<ProgressMetric, number>>;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  has_wall: boolean;
  has_goal: boolean;
  training_load: TrainingLoad; // 033
  space: TrainingSpace; // 033
};

// Complete a player's intake. Players cannot UPDATE their own elite_players
// row under RLS (coach-managed), so this runs through the service client
// after verifying the caller owns the player. Seeds the AI's first memory
// and unlocks the dashboard.
export async function completeOnboarding(input: OnboardingInput) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const };
  if (viewer.demo) return { ok: true as const }; // demo: nothing to persist

  const admin = createServiceClient();
  if (!admin) return { ok: false as const };

  const update: Record<string, unknown> = {
    age: input.age || 0,
    position: input.position.trim(),
    level: input.level || "Developing",
    club: input.club.trim(),
    dominant_foot: input.dominant_foot,
    gender: input.gender,
    goals: input.goals.filter(Boolean).slice(0, 6),
    weaknesses: input.weaknesses.filter(Boolean).slice(0, 6),
    self_assessment: input.self_assessment,
    parent_email: input.parent_email.trim(),
    has_wall: input.has_wall,
    has_goal: input.has_goal,
    training_load: input.training_load in TRAINING_LOADS ? input.training_load : "in_season",
    space: input.space === "tight" ? "tight" : "open",
    onboarded_at: new Date().toISOString(),
  };
  // Same non-destructive pattern as parent_phone below: the form requires
  // this, but never let a stray empty submission wipe a real name already
  // on file - this field feeds every "Hey [Parent]," greeting in SMS/email.
  if (input.parent_name.trim()) {
    update.parent_name = input.parent_name.trim();
  }
  // Only overwrite the phone captured at signup if they actually entered
  // one here - an empty field at intake shouldn't wipe a real number.
  if (input.parent_phone.trim()) {
    update.parent_phone = normalizePhone(input.parent_phone.trim()) ?? input.parent_phone.trim();
  }
  const { error } = await admin
    .from("elite_players")
    .update(update)
    .eq("id", viewer.playerId);
  if (error) {
    // pre-019 / pre-033 (environment or load columns missing): save the
    // rest so onboarding never blocks on a pending migration
    const { has_wall: _w, has_goal: _g, training_load: _l, space: _s, ...legacy } = update;
    await admin.from("elite_players").update(legacy).eq("id", viewer.playerId);
  }

  // Tell the coach a new player finished onboarding.
  await sendCoachEmail(viewer.playerId, {
    event: "player_onboarded",
    subject: `${viewer.profile.full_name} completed their intake`,
    body: `${viewer.profile.full_name} just finished onboarding and is ready for their first week. Open their profile to build it.`,
  }).catch(() => undefined);

  revalidatePath("/dashboard");
  return { ok: true as const };
}

// Toggle a homework item's completion. Persists to Supabase in real mode;
// a safe no-op in demo mode (the UI keeps optimistic state).
export async function toggleHomework(id: string, completed: boolean) {
  const supabase = createClient();
  if (supabase) {
    await supabase
      .from("elite_homework")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (completed) {
      const viewer = await getViewer();
      if (viewer?.playerId) {
        await maybeAwardAchievements(viewer.playerId).catch(() => undefined);
      }
    }
    revalidatePath("/homework");
    revalidatePath("/dashboard");
  }
  return { ok: true };
}

// Player submits their monthly film LINK (Veo/Hudl/YouTube/etc.) for the
// current program month. One submission per month.
export async function submitFilm(input: { url: string; note: string }) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const, error: "unauthorized" };
  const url = input.url.trim();
  if (!/^https?:\/\/.+\..+/.test(url)) {
    return { ok: false as const, error: "Paste a full video link (starting with http)." };
  }
  const supabase = createClient();
  if (!supabase) return { ok: true as const }; // demo

  const { data: player } = await supabase
    .from("elite_players")
    .select("current_week, week1_monday, full_name")
    .eq("id", viewer.playerId)
    .maybeSingle();
  const month = monthFromWeek(liveWeekFor(player?.week1_monday, player?.current_week));

  // one film per program month
  const { data: existing } = await supabase
    .from("elite_film_uploads")
    .select("id")
    .eq("player_id", viewer.playerId)
    .eq("month", month)
    .limit(1);
  if (existing && existing.length > 0) {
    return {
      ok: false as const,
      error: "This month's film is already in. Your coach is on it.",
    };
  }

  const row = {
    player_id: viewer.playerId,
    title: input.note.trim() || `Month ${month} film`,
    url,
    month,
    status: "Uploaded",
  };
  const { error } = await supabase.from("elite_film_uploads").insert(row);
  if (error) {
    // pre-015 (no month column) - insert without it so nothing breaks
    const { month: _m, ...legacy } = row;
    await supabase.from("elite_film_uploads").insert(legacy);
  }

  await sendCoachEmail(viewer.playerId, {
    event: "film_submitted",
    subject: `${viewer.profile.full_name} submitted month ${month} film`,
    body: `${viewer.profile.full_name} submitted their film for month ${month}.\n\n${url}\n\nNote: ${input.note || "-"}\n\nWatch it and leave feedback on their profile.`,
  }).catch(() => undefined);

  revalidatePath("/film");
  return { ok: true as const };
}

// Player posts an upcoming game so the coach can plan to attend
// (Northern Virginia games especially).
export async function addGame(input: {
  game_date: string;
  kickoff: string;
  opponent: string;
  location: string;
  notes: string;
}) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const, error: "unauthorized" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.game_date)) {
    return { ok: false as const, error: "Pick a game date." };
  }
  const supabase = createClient();
  if (!supabase) return { ok: true as const }; // demo

  const { error } = await supabase.from("elite_games").insert({
    player_id: viewer.playerId,
    game_date: input.game_date,
    kickoff: input.kickoff.trim(),
    opponent: input.opponent.trim(),
    location: input.location.trim(),
    notes: input.notes.trim(),
  });
  if (error) {
    return { ok: false as const, error: "Couldn't save the game. Try again." };
  }

  await sendCoachEmail(viewer.playerId, {
    event: "game_submitted",
    subject: `${viewer.profile.full_name} added a game`,
    body: `${viewer.profile.full_name} has a game on ${input.game_date}${input.kickoff ? ` at ${input.kickoff}` : ""}${input.opponent ? ` vs ${input.opponent}` : ""}${input.location ? ` - ${input.location}` : ""}.\n\nOpen their profile to mark yourself as attending.`,
  }).catch(() => undefined);

  revalidatePath("/film");
  return { ok: true as const };
}

// Mark a single notification read.
export async function markNotificationRead(id: string) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase
      .from("elite_notifications")
      .update({ read: true })
      .eq("id", id)
      .eq("player_id", viewer.playerId);
    revalidatePath("/dashboard");
  }
  return { ok: true };
}

// Mark all of the current player's notifications read.
export async function markAllNotificationsRead() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase
      .from("elite_notifications")
      .update({ read: true })
      .eq("player_id", viewer.playerId)
      .eq("read", false);
    revalidatePath("/dashboard");
  }
  return { ok: true };
}

// Player replies to their coach.
export async function sendPlayerMessage(body: string) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase.from("elite_messages").insert({
      player_id: viewer.playerId,
      from_role: "player",
      from_name: viewer.profile.full_name,
      body,
    });
    // Nudge the coach by email (best-effort).
    await sendCoachEmail(viewer.playerId, {
      event: "player_message",
      subject: `New message from ${viewer.profile.full_name}`,
      body: `${viewer.profile.full_name} sent you a message:\n\n"${body}"`,
    }).catch(() => undefined);
    revalidatePath("/dashboard");
    revalidatePath("/messages");
  }
  return { ok: true };
}

// Send a clip (offer stack item 5, Oct 13 2026): the player filmed a drill
// and uploaded it from the browser into their own folder of the private
// elite-film bucket (storage RLS, migration 036). This records it as a
// message in their chat with the coach and pings the coach. Same cookie
// client and same insert policy as sendPlayerMessage.
export async function sendClip(input: { homeworkId: string; path: string }) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const, error: "Sign in first." };
  if (viewer.demo) return { ok: true as const };
  if (!ownsClipPath(input.path, viewer.playerId)) {
    return { ok: false as const, error: "That clip isn't yours." };
  }
  const supabase = createClient();
  if (!supabase) return { ok: true as const };

  const { data: hw } = await supabase
    .from("elite_homework")
    .select("id, title")
    .eq("id", input.homeworkId)
    .eq("player_id", viewer.playerId)
    .maybeSingle();
  if (!hw) return { ok: false as const, error: "That drill isn't on your plan." };
  const title = String(hw.title);

  const { error } = await supabase.from("elite_messages").insert({
    player_id: viewer.playerId,
    from_role: "player",
    from_name: viewer.profile.full_name,
    body: `Sent a clip of ${title}.`,
    clip_path: input.path,
    clip_label: title,
  });
  if (error) return { ok: false as const, error: "Couldn't send the clip. Try again." };

  await sendCoachEmail(viewer.playerId, {
    event: "player_clip",
    subject: `${viewer.profile.full_name} sent a clip: ${title}`,
    body: `${viewer.profile.full_name} sent a clip of ${title} for feedback. Open their profile and reply in the thread.`,
  }).catch(() => undefined);

  revalidatePath("/dashboard");
  revalidatePath("/homework");
  revalidatePath("/messages");
  revalidatePath(`/coach/players/${viewer.playerId}`);
  return { ok: true as const };
}

// Bi-weekly progress video (offer stack item 7, Oct 13 2026): the player
// filmed their benchmark drill for this progress week and uploaded it
// into progress/<player_id>/<week>/ (storage RLS, 037). Records the row,
// texts the parent the link (plus the one from two weeks ago when it
// exists) in Coach Yinka's voice, pings the coach. One per week, by the
// database's unique constraint.
export async function submitProgressVideo(input: { path: string; week: number; shareOk: boolean }) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const, error: "Sign in first." };
  if (viewer.demo) return { ok: true as const };
  const supabase = createClient();
  if (!supabase) return { ok: true as const };

  const { data: player } = await supabase
    .from("elite_players")
    .select("id, full_name, parent_name, current_week, week1_monday, benchmark_drill_id")
    .eq("id", viewer.playerId)
    .maybeSingle();
  if (!player) return { ok: false as const, error: "Player not found." };
  const homework = await getHomework(player.id);
  const live = liveWeekFor(player.week1_monday, player.current_week);
  const maxBuilt = homework.reduce((m, h) => Math.max(m, h.week), 0);
  const week = Math.max(1, Math.min(live, maxBuilt || 1));
  if (input.week !== week) return { ok: false as const, error: "That week has moved on. Refresh and film again." };
  if (!ownsProgressPath(input.path, player.id, week)) return { ok: false as const, error: "That clip isn't yours." };

  const existing = await getProgressVideos(player.id);
  if (!progressVideoDue(week, existing)) {
    return { ok: false as const, error: "This week's progress video is already in, or it isn't a progress week." };
  }
  const bench = await getBenchmark(player, homework);
  if (!bench) return { ok: false as const, error: "Finish a skill drill first so there's a drill to film." };

  const { error } = await supabase.from("elite_progress_videos").insert({
    player_id: player.id,
    week,
    drill_id: bench.drill_id,
    drill_title: bench.title,
    clip_path: input.path,
    share_ok: Boolean(input.shareOk),
  });
  if (error) return { ok: false as const, error: "Couldn't save the video. Try again." };

  // Parent text with 30-day links, signed by the service client (the
  // parent has no login; the player's account is the family's).
  const admin = createServiceClient();
  const first = player.full_name.split(" ")[0];
  const parentFirst = (player.parent_name || "").trim().split(" ")[0];
  if (admin) {
    const prev = previousProgressVideo(week, existing);
    const paths = [input.path, ...(prev ? [prev.clip_path] : [])];
    const { data: signed } = await admin.storage.from(CLIP_BUCKET).createSignedUrls(paths, 60 * 60 * 24 * 30);
    const urlFor = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
    const nowUrl = urlFor.get(input.path);
    const prevUrl = prev ? urlFor.get(prev.clip_path) : undefined;
    if (nowUrl) {
      const greeting = parentFirst ? `Hey ${parentFirst}, ` : "";
      const message =
        `${greeting}${first} just filmed the week ${week} progress clip of ${bench.title}, the same drill every two weeks so you can see the work adding up: ${nowUrl}` +
        (prevUrl ? ` Two weeks ago: ${prevUrl}` : "") +
        ` Let's keep ${first} dialed in.`;
      const sent = await sendPlayerSMS(player.id, { event: "progress_video", message }).catch(() => false);
      if (sent) {
        await admin
          .from("elite_progress_videos")
          .update({ parent_sent_at: new Date().toISOString() })
          .eq("player_id", player.id)
          .eq("week", week);
      }
    }
  }

  await sendCoachEmail(player.id, {
    event: "progress_video",
    subject: `${player.full_name} filmed the week ${week} progress video`,
    body: `${player.full_name} filmed ${bench.title} for week ${week}.${input.shareOk ? " The family said it's OK to share in the community." : " Not cleared for the community."} Open their profile to watch it.`,
  }).catch(() => undefined);

  revalidatePath("/dashboard");
  revalidatePath(`/coach/players/${player.id}`);
  return { ok: true as const };
}

export type CheckinInput = {
  rating: number;
  energy: number;
  went_well: string;
  struggled: string;
  note: string;
};

// Player submits their structured weekly check-in.
export async function submitCheckin(input: CheckinInput) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const };
  const supabase = createClient();
  if (!supabase) return { ok: true as const }; // demo

  // week = the week the player is actually training: live calendar week,
  // clamped to their latest built week.
  const { data: player } = await supabase
    .from("elite_players")
    .select("current_week, week1_monday, full_name")
    .eq("id", viewer.playerId)
    .maybeSingle();
  const { data: latest } = await supabase
    .from("elite_homework")
    .select("week")
    .eq("player_id", viewer.playerId)
    .order("week", { ascending: false })
    .limit(1)
    .maybeSingle();
  const live = liveWeekFor(player?.week1_monday, player?.current_week);
  const checkinWeek = Math.max(1, Math.min(live, latest?.week ?? 1));

  await supabase.from("elite_checkins").insert({
    player_id: viewer.playerId,
    week: checkinWeek,
    rating: input.rating || null,
    energy: input.energy || null,
    went_well: input.went_well.trim(),
    struggled: input.struggled.trim(),
    note: input.note.trim(),
  });

  await sendCoachEmail(viewer.playerId, {
    event: "checkin_submitted",
    subject: `${viewer.profile.full_name} submitted their weekly check-in`,
    body: `${viewer.profile.full_name} checked in for week ${checkinWeek}.\n\nWent well: ${input.went_well || "-"}\nStruggled: ${input.struggled || "-"}\nNote: ${input.note || "-"}`,
  }).catch(() => undefined);

  revalidatePath("/dashboard");
  return { ok: true as const };
}
