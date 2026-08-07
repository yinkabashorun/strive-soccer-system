"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { getViewer } from "./session";
import type { GeneratedPlan } from "./types";

async function requireCoach() {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return null;
  return viewer;
}

// Update a player's editable list fields (goals / strengths / weaknesses).
export async function updatePlayerArrays(
  playerId: string,
  patch: { goals?: string[]; strengths?: string[]; weaknesses?: string[] }
) {
  if (!(await requireCoach())) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase.from("elite_players").update(patch).eq("id", playerId);
    revalidatePath(`/coach/players/${playerId}`);
  }
  return { ok: true };
}

// Update simple scalar fields (today_focus, level, next_session_at, etc.).
export async function updatePlayerFields(
  playerId: string,
  patch: Record<string, string | number | null>
) {
  if (!(await requireCoach())) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase.from("elite_players").update(patch).eq("id", playerId);
    revalidatePath(`/coach/players/${playerId}`);
  }
  return { ok: true };
}

export async function addCoachNote(playerId: string, body: string) {
  if (!(await requireCoach())) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase.from("elite_coach_notes").insert({ player_id: playerId, body });
    revalidatePath(`/coach/players/${playerId}`);
  }
  return { ok: true };
}

export async function sendCoachMessage(playerId: string, body: string) {
  const viewer = await requireCoach();
  if (!viewer) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase.from("elite_messages").insert({
      player_id: playerId,
      from_role: "coach",
      from_name: viewer.profile.full_name,
      body,
    });
    revalidatePath(`/coach/players/${playerId}`);
  }
  return { ok: true };
}

export async function setFilmNotes(filmId: string, playerId: string, notes: string) {
  if (!(await requireCoach())) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase
      .from("elite_film_uploads")
      .update({ coach_notes: notes, status: "Reviewed" })
      .eq("id", filmId);
    revalidatePath(`/coach/players/${playerId}`);
  }
  return { ok: true };
}

// Persist an AI-generated plan across all the tables it touches.
export async function applyGeneratedPlan(
  playerId: string,
  rawNotes: string,
  plan: GeneratedPlan
) {
  const viewer = await requireCoach();
  if (!viewer) return { ok: false };
  const supabase = createClient();
  if (!supabase) return { ok: true }; // demo mode: nothing to persist

  // current week for tagging
  const { data: player } = await supabase
    .from("elite_players")
    .select("current_week")
    .eq("id", playerId)
    .maybeSingle();
  const week = (player?.current_week ?? 1) + 1;

  // 1) record the session
  await supabase.from("elite_sessions").insert({
    player_id: playerId,
    coach_id: viewer.profile.id,
    focus: plan.weekly_focus,
    raw_notes: rawNotes,
  });

  // 2) replace this week's homework
  await supabase.from("elite_homework").delete().eq("player_id", playerId).eq("week", week);
  if (plan.homework.length) {
    await supabase.from("elite_homework").insert(
      plan.homework.map((h, i) => ({
        player_id: playerId,
        week,
        title: h.title,
        exercise: h.exercise,
        reps: h.reps,
        notes: h.notes ?? null,
        sort: i,
      }))
    );
  }

  // 3) bump progress ratings (store prev for trend)
  for (const upd of plan.progress_updates) {
    const { data: existing } = await supabase
      .from("elite_progress")
      .select("value")
      .eq("player_id", playerId)
      .eq("metric", upd.metric)
      .maybeSingle();
    await supabase.from("elite_progress").upsert(
      {
        player_id: playerId,
        metric: upd.metric,
        value: upd.value,
        prev_value: existing?.value ?? upd.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "player_id,metric" }
    );
  }

  // 4) weekly plan
  await supabase.from("elite_weekly_plans").insert({
    player_id: playerId,
    week,
    focus: plan.weekly_focus,
    objectives: plan.next_week_objectives,
    homework: plan.homework,
  });

  // 5) parent report
  await supabase.from("elite_parent_reports").insert({
    player_id: playerId,
    summary: plan.player_summary,
    improvement: plan.parent_update,
    homework: plan.homework.map((h) => `${h.title} — ${h.reps}`).join("; "),
    next_focus: plan.next_week_objectives.join("; "),
  });

  // 6) advance the player's week + today's focus
  await supabase
    .from("elite_players")
    .update({
      current_week: week,
      today_focus: plan.weekly_focus,
      last_session_at: new Date().toISOString(),
    })
    .eq("id", playerId);

  revalidatePath(`/coach/players/${playerId}`);
  return { ok: true };
}
