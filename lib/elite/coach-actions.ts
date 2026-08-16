"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { getViewer } from "./session";
import { sendPlayerEmail } from "./email";
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
    // In-app notification + email for the player (best-effort).
    await supabase.from("elite_notifications").insert({
      player_id: playerId,
      kind: "coach_message",
      title: "Message from your coach",
      body: body.slice(0, 140),
    });
    await sendPlayerEmail(playerId, {
      subject: "Your coach sent you a message",
      body: `${viewer.profile.full_name}: "${body}"`,
    }).catch(() => undefined);
    revalidatePath(`/coach/players/${playerId}`);
  }
  return { ok: true };
}

// Coach replies to a player's weekly check-in.
export async function addCheckinFeedback(
  checkinId: string,
  playerId: string,
  feedback: string
) {
  if (!(await requireCoach())) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase
      .from("elite_checkins")
      .update({
        coach_feedback: feedback.trim(),
        coach_feedback_at: new Date().toISOString(),
      })
      .eq("id", checkinId);
    await supabase.from("elite_notifications").insert({
      player_id: playerId,
      kind: "checkin_feedback",
      title: "Coach replied to your check-in",
      body: feedback.slice(0, 140),
    });
    await sendPlayerEmail(playerId, {
      subject: "Your coach replied to your check-in",
      body: feedback,
    }).catch(() => undefined);
    revalidatePath(`/coach/players/${playerId}`);
  }
  return { ok: true };
}

// Clone a week's drills from one player to another (or to a new week for
// the same player). Uses the elite_duplicate_week RPC when available, with
// a TS fallback for before 009_player_loop.sql is applied.
export async function duplicateWeek(input: {
  fromPlayerId: string;
  week: number;
  toPlayerId: string;
  toWeek: number;
}) {
  if (!(await requireCoach())) return { ok: false as const, cloned: 0 };
  const supabase = createClient();
  if (!supabase) return { ok: true as const, cloned: 0 }; // demo

  const { data, error } = await supabase.rpc("elite_duplicate_week", {
    p_from_player: input.fromPlayerId,
    p_week: input.week,
    p_to_player: input.toPlayerId,
    p_to_week: input.toWeek,
  });
  if (!error) {
    revalidatePath(`/coach/players/${input.toPlayerId}`);
    return { ok: true as const, cloned: (data as number) ?? 0 };
  }

  // fallback: clone in application code
  const { data: rows } = await supabase
    .from("elite_homework")
    .select("title, exercise, reps, duration_min, video_url, notes, sort")
    .eq("player_id", input.fromPlayerId)
    .eq("week", input.week)
    .order("sort");
  if (!rows || rows.length === 0) return { ok: true as const, cloned: 0 };

  await supabase
    .from("elite_homework")
    .delete()
    .eq("player_id", input.toPlayerId)
    .eq("week", input.toWeek);

  await supabase.from("elite_homework").insert(
    rows.map((r) => ({ ...r, player_id: input.toPlayerId, week: input.toWeek }))
  );
  revalidatePath(`/coach/players/${input.toPlayerId}`);
  return { ok: true as const, cloned: rows.length };
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

  // Decide which week this plan fills. A brand-new player sits on week 1
  // with no drills — the first plan should FILL week 1, not skip to week 2.
  // Otherwise advance to the next week.
  const { data: player } = await supabase
    .from("elite_players")
    .select("current_week")
    .eq("id", playerId)
    .maybeSingle();
  const currentWeek = player?.current_week ?? 1;
  const { data: existingThisWeek } = await supabase
    .from("elite_homework")
    .select("id")
    .eq("player_id", playerId)
    .eq("week", currentWeek)
    .limit(1);
  const week = existingThisWeek && existingThisWeek.length > 0
    ? currentWeek + 1
    : currentWeek;

  // 1) record the session
  await supabase.from("elite_sessions").insert({
    player_id: playerId,
    coach_id: viewer.profile.id,
    focus: plan.weekly_focus,
    raw_notes: rawNotes,
  });

  // 2) replace this week's homework — four sessions, each starting with a
  //    plyometric warm-up (already baked into plan.sessions).
  await supabase.from("elite_homework").delete().eq("player_id", playerId).eq("week", week);
  const rows = plan.sessions.flatMap((s, si) =>
    s.drills.map((d, di) => ({
      player_id: playerId,
      week,
      session: si + 1,
      title: d.title,
      exercise: d.exercise,
      reps: d.reps,
      duration_min: d.minutes ?? 15,
      notes: d.notes ?? null,
      sort: di,
    }))
  );
  if (rows.length) {
    const { error: hwErr } = await supabase.from("elite_homework").insert(rows);
    if (hwErr) {
      // 010 not applied yet (no `session` column) — retry without it so
      // plan-building still works; drills collapse into one session until
      // the migration lands.
      await supabase
        .from("elite_homework")
        .insert(
          rows.map(({ session: _session, ...r }) => r)
        );
    }
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

  // 3b) append to progress history so long-term progression is real +
  //     chartable (best-effort — ignored if 011 isn't applied yet).
  if (plan.progress_updates.length) {
    await supabase
      .from("elite_progress_history")
      .insert(
        plan.progress_updates.map((upd) => ({
          player_id: playerId,
          metric: upd.metric,
          value: upd.value,
          week,
        }))
      )
      .then(
        () => undefined,
        () => undefined
      );
  }

  // 4) weekly plan (stores the four-session structure)
  await supabase.from("elite_weekly_plans").insert({
    player_id: playerId,
    week,
    focus: plan.weekly_focus,
    objectives: plan.next_week_objectives,
    homework: plan.sessions,
  });

  // 5) parent report
  await supabase.from("elite_parent_reports").insert({
    player_id: playerId,
    summary: plan.player_summary,
    improvement: plan.parent_update,
    homework: `Four at-home sessions this week, each opening with a plyometric warm-up. Focus: ${plan.weekly_focus}`,
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

  // 7) tell the player their new week is ready (email — the in-app
  //    notification is fired by the elite_notify_new_week DB trigger).
  await sendPlayerEmail(playerId, {
    subject: `Week ${week} is ready`,
    body: `Your new training week is live.\n\nThis week's focus: ${plan.weekly_focus}\n\nFour sessions, each starting with your plyometric warm-up. Open Strive Elite to get going.`,
  }).catch(() => undefined);

  revalidatePath(`/coach/players/${playerId}`);
  return { ok: true };
}
