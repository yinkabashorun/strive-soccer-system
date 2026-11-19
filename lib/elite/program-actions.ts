"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { getViewer } from "./session";
import { liveWeekFor } from "./time";
import { cleanFocuses, cleanQuiz, cleanThreads, PROGRAM_WEEKS } from "./program";

// The 3-month program (065). Coach-only writes through the cookie client
// (RLS: elite_programs_coach_all). Saving never touches a week that is
// already built: a new program starts with the first week not yet built,
// and editing a running program changes only the weeks still to come.

export type ProgramInput = {
  focuses: unknown;
  threads: unknown;
  quiz: unknown;
};

async function coachClient() {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return { error: "unauthorized" as const };
  if (viewer.demo) return { demo: true as const };
  const supabase = createClient();
  if (!supabase) return { demo: true as const };
  return { supabase, profileId: viewer.profile.id };
}

export async function saveProgram(playerId: string, input: ProgramInput) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: "Not allowed." };
  if ("demo" in c) return { ok: true as const, start_week: 1 };

  const focuses = cleanFocuses(input.focuses);
  if (!focuses) return { ok: false as const, error: "Pick a focus for all six half-months." };
  const threads = cleanThreads(input.threads);
  const quiz = cleanQuiz(input.quiz);

  const [{ data: player }, { data: latest }, { data: existing }] = await Promise.all([
    c.supabase.from("elite_players").select("week1_monday, current_week").eq("id", playerId).maybeSingle(),
    c.supabase
      .from("elite_homework")
      .select("week")
      .eq("player_id", playerId)
      .order("week", { ascending: false })
      .limit(1)
      .maybeSingle(),
    c.supabase.from("elite_programs").select("id, start_week").eq("player_id", playerId).eq("status", "active").maybeSingle(),
  ]);
  if (!player) return { ok: false as const, error: "Player not found." };

  const maxBuilt = (latest as { week: number } | null)?.week ?? 0;
  const liveWeek = player.week1_monday ? liveWeekFor(player.week1_monday, player.current_week) : 1;
  // The first week this program can shape: the first one not built yet.
  const firstOpenWeek = Math.max(maxBuilt + 1, liveWeek);

  const current = existing as { id: string; start_week: number } | null;
  if (current) {
    // A program that has already had a week built keeps its start; one
    // that has not started yet moves to the first open week.
    const started = current.start_week <= maxBuilt;
    const start_week = started ? current.start_week : firstOpenWeek;
    const { error } = await c.supabase
      .from("elite_programs")
      .update({ focuses, threads, quiz, start_week, updated_at: new Date().toISOString() })
      .eq("id", current.id);
    if (error) return { ok: false as const, error: "Couldn't save the program." };
    revalidatePath(`/coach/players/${playerId}`);
    return { ok: true as const, start_week };
  }

  const { error } = await c.supabase.from("elite_programs").insert({
    player_id: playerId,
    start_week: firstOpenWeek,
    weeks: PROGRAM_WEEKS,
    status: "active",
    focuses,
    threads,
    quiz,
    created_by: c.profileId,
  });
  if (error) return { ok: false as const, error: "Couldn't save the program. Run database migration 065 first." };
  revalidatePath(`/coach/players/${playerId}`);
  return { ok: true as const, start_week: firstOpenWeek };
}

// Ends the active program. Weeks already built stay as they are; the next
// build goes back to the ordinary week.
export async function endProgram(playerId: string) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: "Not allowed." };
  if ("demo" in c) return { ok: true as const };
  const { error } = await c.supabase
    .from("elite_programs")
    .update({ status: "ended", updated_at: new Date().toISOString() })
    .eq("player_id", playerId)
    .eq("status", "active");
  if (error) return { ok: false as const, error: "Couldn't end the program." };
  revalidatePath(`/coach/players/${playerId}`);
  return { ok: true as const };
}
