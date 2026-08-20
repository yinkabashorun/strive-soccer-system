"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "./supabase/server";
import { getViewer } from "./session";
import { sendCoachEmail } from "./email";
import { monthFromWeek } from "./time";
import type { ProgressMetric } from "./types";

export type OnboardingInput = {
  age: number;
  position: string;
  level: string;
  club: string;
  dominant_foot: string;
  goals: string[];
  weaknesses: string[];
  self_assessment: Partial<Record<ProgressMetric, number>>;
  parent_name: string;
  parent_email: string;
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

  await admin
    .from("elite_players")
    .update({
      age: input.age || 0,
      position: input.position.trim(),
      level: input.level || "Developing",
      club: input.club.trim(),
      dominant_foot: input.dominant_foot,
      goals: input.goals.filter(Boolean).slice(0, 6),
      weaknesses: input.weaknesses.filter(Boolean).slice(0, 6),
      self_assessment: input.self_assessment,
      parent_name: input.parent_name.trim(),
      parent_email: input.parent_email.trim(),
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", viewer.playerId);

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
    .select("current_week, full_name")
    .eq("id", viewer.playerId)
    .maybeSingle();
  const month = monthFromWeek(player?.current_week ?? 1);

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
      error: "This month's film is already in — your coach is on it.",
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
    // pre-015 (no month column) — insert without it so nothing breaks
    const { month: _m, ...legacy } = row;
    await supabase.from("elite_film_uploads").insert(legacy);
  }

  await sendCoachEmail(viewer.playerId, {
    event: "film_submitted",
    subject: `${viewer.profile.full_name} submitted month ${month} film`,
    body: `${viewer.profile.full_name} submitted their film for month ${month}.\n\n${url}\n\nNote: ${input.note || "—"}\n\nWatch it and leave feedback on their profile.`,
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
    body: `${viewer.profile.full_name} has a game on ${input.game_date}${input.kickoff ? ` at ${input.kickoff}` : ""}${input.opponent ? ` vs ${input.opponent}` : ""}${input.location ? ` — ${input.location}` : ""}.\n\nOpen their profile to mark yourself as attending.`,
  }).catch(() => undefined);

  revalidatePath("/film");
  return { ok: true as const };
}

// Mark a single notification read.
export async function markNotificationRead(id: string) {
  const supabase = createClient();
  if (supabase) {
    await supabase.from("elite_notifications").update({ read: true }).eq("id", id);
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

  // week = the player's current week
  const { data: player } = await supabase
    .from("elite_players")
    .select("current_week, full_name")
    .eq("id", viewer.playerId)
    .maybeSingle();

  await supabase.from("elite_checkins").insert({
    player_id: viewer.playerId,
    week: player?.current_week ?? 1,
    rating: input.rating || null,
    energy: input.energy || null,
    went_well: input.went_well.trim(),
    struggled: input.struggled.trim(),
    note: input.note.trim(),
  });

  await sendCoachEmail(viewer.playerId, {
    event: "checkin_submitted",
    subject: `${viewer.profile.full_name} submitted their weekly check-in`,
    body: `${viewer.profile.full_name} checked in for week ${player?.current_week ?? 1}.\n\nWent well: ${input.went_well || "—"}\nStruggled: ${input.struggled || "—"}\nNote: ${input.note || "—"}`,
  }).catch(() => undefined);

  revalidatePath("/dashboard");
  return { ok: true as const };
}
