"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "./supabase/server";
import { getViewer } from "./session";
import { sendCoachEmail } from "./email";
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

// Record a film upload's metadata after the file lands in Storage.
export async function recordFilm(input: {
  title: string;
  url?: string | null;
}) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase.from("elite_film_uploads").insert({
      player_id: viewer.playerId,
      title: input.title,
      url: input.url ?? null,
      status: "Uploaded",
    });
    revalidatePath("/film");
  }
  return { ok: true };
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
