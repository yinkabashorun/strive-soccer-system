"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { getViewer } from "./session";
import { sendPlayerEmail } from "./email";
import { mondayOfWeekNY, nextMondayNY, unlockInstant } from "./time";
import type { FilmReview, GeneratedPlan } from "./types";

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
      event: "coach_message",
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
      event: "checkin_feedback",
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

// Coach marks (or unmarks) attendance for a player's game. Marking it
// tells the player Coach is coming - the premium moment.
export async function setGameAttendance(
  gameId: string,
  playerId: string,
  attending: boolean,
  gameDate?: string
) {
  if (!(await requireCoach())) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase
      .from("elite_games")
      .update({ coach_attending: attending })
      .eq("id", gameId);
    if (attending) {
      await supabase.from("elite_notifications").insert({
        player_id: playerId,
        kind: "coach_attending",
        title: "Coach is coming to your game",
        body: gameDate ? `See you out there on ${gameDate}. Play brave.` : "See you out there. Play brave.",
      });
      await sendPlayerEmail(playerId, {
        event: "coach_attending",
        subject: "Coach is coming to the game",
        body: `Coach marked himself as attending${gameDate ? ` the game on ${gameDate}` : " the upcoming game"}. See you out there.`,
      }).catch(() => undefined);
    }
    revalidatePath(`/coach/players/${playerId}`);
    revalidatePath("/film");
  }
  return { ok: true };
}

// Coach reviews a monthly film submission - feedback lands in the app and
// pings the player/parent.
// Trim, drop empties, and cap sizes on a client-composed review so junk
// input can't bloat the row or the player's screen.
function cleanReview(raw: FilmReview): FilmReview {
  const line = (s: string) => s.trim().slice(0, 300);
  const list = (a: string[] | undefined) =>
    (a ?? []).map(line).filter(Boolean).slice(0, 8);
  return {
    summary: (raw.summary ?? "").trim().slice(0, 1200),
    moments: (raw.moments ?? [])
      .map((m) => ({
        time: (m.time ?? "").trim().slice(0, 8),
        note: line(m.note ?? ""),
        kind: m.kind === "good" ? ("good" as const) : ("fix" as const),
      }))
      .filter((m) => m.note)
      .slice(0, 12),
    strengths: list(raw.strengths),
    fixes: list(raw.fixes),
    next_steps: list(raw.next_steps),
  };
}

// Flatten a structured review into plain text - for the email and for the
// pre-017 fallback where the review column doesn't exist yet.
function flattenReview(r: FilmReview): string {
  const parts: string[] = [r.summary];
  if (r.moments.length)
    parts.push(
      "Key moments:\n" +
        r.moments
          .map((m) => `${m.time ? m.time + " - " : ""}${m.note}`)
          .join("\n")
    );
  if (r.strengths.length)
    parts.push("What's working:\n" + r.strengths.map((s) => `• ${s}`).join("\n"));
  if (r.fixes.length)
    parts.push("What we're fixing:\n" + r.fixes.map((s) => `• ${s}`).join("\n"));
  if (r.next_steps.length)
    parts.push(
      "Next steps:\n" + r.next_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
    );
  return parts.filter(Boolean).join("\n\n");
}

// Send the coach's structured film breakdown: store it, mark the film
// Reviewed, and notify the player in-app + email. coach_notes gets the
// summary so anything still reading the old field shows the right thing.
export async function sendFilmReview(
  filmId: string,
  playerId: string,
  rawReview: FilmReview
) {
  if (!(await requireCoach())) return { ok: false };
  const review = cleanReview(rawReview);
  if (!review.summary) return { ok: false, error: "Write the summary first." };
  const supabase = createClient();
  if (supabase) {
    const { error } = await supabase
      .from("elite_film_uploads")
      .update({ review, coach_notes: review.summary, status: "Reviewed" })
      .eq("id", filmId);
    if (error) {
      // review column not migrated yet (pre-017) - store the full breakdown
      // as plain text so nothing is lost.
      await supabase
        .from("elite_film_uploads")
        .update({ coach_notes: flattenReview(review), status: "Reviewed" })
        .eq("id", filmId);
    }
    await supabase.from("elite_notifications").insert({
      player_id: playerId,
      kind: "film_feedback",
      title: "Your film breakdown is in",
      body: review.summary.slice(0, 140),
    });
    await sendPlayerEmail(playerId, {
      event: "film_feedback",
      subject: "Coach broke down your film",
      body: `Your monthly film breakdown is in:\n\n${flattenReview(review)}\n\nOpen the app to see it with your film.`,
    }).catch(() => undefined);
    revalidatePath(`/coach/players/${playerId}`);
    revalidatePath("/film");
  }
  return { ok: true };
}

// Persist an approved plan across all the tables it touches.
//
// Timing model (America/New_York): a player's FIRST week goes live the
// moment it's published (week1_monday = this NY week's Monday), so
// onboarding never dead-ends. Every later plan targets the NEXT week and
// unlocks automatically Monday morning - publishing twice in one evening
// can never fast-forward anyone again.
export async function applyGeneratedPlan(
  playerId: string,
  rawNotes: string,
  plan: GeneratedPlan
) {
  const viewer = await requireCoach();
  if (!viewer) return { ok: false };
  const supabase = createClient();
  if (!supabase) return { ok: true }; // demo mode: nothing to persist

  const { data: player } = await supabase
    .from("elite_players")
    .select("current_week, week1_monday, full_name")
    .eq("id", playerId)
    .maybeSingle();

  const firstWeek = !player?.week1_monday;
  const currentWeek = player?.current_week ?? 1;
  let week: number;
  let unlocksAt: string; // ISO
  let goesLiveNow: boolean;
  if (firstWeek) {
    week = 1;
    unlocksAt = new Date().toISOString();
    goesLiveNow = true;
  } else {
    // Re-publishing before the scheduled week unlocks REPLACES it (edit
    // window); otherwise target the week after the live one.
    const { data: pending } = await supabase
      .from("elite_weekly_plans")
      .select("week")
      .eq("player_id", playerId)
      .eq("notified", false)
      .gt("unlocks_at", new Date().toISOString())
      .order("week", { ascending: false })
      .limit(1)
      .maybeSingle();
    week = pending?.week ?? currentWeek + 1;
    unlocksAt = unlockInstant(nextMondayNY());
    goesLiveNow = false;
  }

  // 1) record the session
  await supabase.from("elite_sessions").insert({
    player_id: playerId,
    coach_id: viewer.profile.id,
    focus: plan.weekly_focus,
    raw_notes: rawNotes,
  });

  // 2) replace this week's homework - four sessions, each starting with a
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
      // 010 not applied yet (no `session` column) - retry without it so
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
  //     chartable (best-effort - ignored if 011 isn't applied yet).
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

  // 4) weekly plan (stores the four-session structure + unlock schedule).
  //    Replace any prior draft for the same week so re-publishing edits.
  await supabase
    .from("elite_weekly_plans")
    .delete()
    .eq("player_id", playerId)
    .eq("week", week);
  const { error: planErr } = await supabase.from("elite_weekly_plans").insert({
    player_id: playerId,
    week,
    focus: plan.weekly_focus,
    objectives: plan.next_week_objectives,
    homework: plan.sessions,
    unlocks_at: unlocksAt,
    notified: goesLiveNow, // live-now weeks are notified inline below
  });
  if (planErr) {
    // pre-014 database - fall back to the legacy shape
    await supabase.from("elite_weekly_plans").insert({
      player_id: playerId,
      week,
      focus: plan.weekly_focus,
      objectives: plan.next_week_objectives,
      homework: plan.sessions,
    });
  }

  // 5) parent report
  await supabase.from("elite_parent_reports").insert({
    player_id: playerId,
    summary: plan.player_summary,
    improvement: plan.parent_update,
    homework: `Four at-home sessions this week, each opening with a plyometric warm-up. Focus: ${plan.weekly_focus}`,
    next_focus: plan.next_week_objectives.join("; "),
  });

  // 6) record the session date; go-live handling depends on timing.
  await supabase
    .from("elite_players")
    .update({ last_session_at: new Date().toISOString() })
    .eq("id", playerId);

  if (goesLiveNow) {
    // First week: live immediately. Anchor the program clock to this NY
    // week's Monday and tell the player now.
    const first = player?.full_name?.split(" ")[0] ?? "";
    await supabase
      .from("elite_players")
      .update({
        current_week: week,
        today_focus: plan.weekly_focus,
        week1_monday: mondayOfWeekNY(0),
      })
      .eq("id", playerId);
    await supabase.from("elite_notifications").insert({
      player_id: playerId,
      kind: "new_week",
      title: first ? `Week ${week} is ready, ${first}` : `Week ${week} is ready`,
      body: plan.weekly_focus || "Your coach set your focus for the week.",
    });
    await sendPlayerEmail(playerId, {
      event: "new_week",
      subject: first ? `${first}, your first week is live` : "Your first week is live",
      body: `Your Strive Elite training starts now.\n\nThis week's focus: ${plan.weekly_focus}\n\nFour sessions, each opening with your plyometric warm-up. Open the app and start Session 1.`,
    }).catch(() => undefined);
  }
  // Scheduled weeks stay silent until Monday morning - unlockDueWeeks()
  // flips them live and notifies then.

  revalidatePath(`/coach/players/${playerId}`);
  return { ok: true, week, goesLiveNow, unlocksAt };
}
