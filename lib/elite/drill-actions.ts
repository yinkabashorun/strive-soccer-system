"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { getViewer } from "./session";
import { PROGRESS_METRICS } from "./types";

export type DrillInput = {
  id?: string; // present = update, absent = create
  pillar: string;
  title: string;
  how: string;
  reps: string;
  minutes: number;
  cues: string;
  needs_wall: boolean;
};

// Coach-only writes. Demo mode returns ok without persisting so the tour
// never errors.
async function coachClient() {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return { error: "unauthorized" as const };
  if (viewer.demo) return { demo: true as const };
  const supabase = createClient();
  if (!supabase) return { demo: true as const };
  return { supabase };
}

export async function saveDrill(input: DrillInput) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: c.error };
  if ("demo" in c) return { ok: true as const };

  const pillar = (PROGRESS_METRICS as readonly string[]).includes(input.pillar)
    ? input.pillar
    : "Ball Mastery";
  const row = {
    pillar,
    title: input.title.trim().slice(0, 120),
    how: input.how.trim().slice(0, 600),
    reps: input.reps.trim().slice(0, 120),
    minutes: Math.max(3, Math.min(30, Math.round(input.minutes) || 10)),
    cues: input.cues.trim().slice(0, 240),
    needs_wall: Boolean(input.needs_wall),
  };
  if (!row.title) return { ok: false as const, error: "Give the drill a name." };

  const { error } = input.id
    ? await c.supabase.from("elite_drills").update(row).eq("id", input.id)
    : await c.supabase.from("elite_drills").insert(row);
  if (error) {
    // pre-020: the table doesn't exist yet
    return {
      ok: false as const,
      error: "Couldn't save. Run database migration 020 first.",
    };
  }
  revalidatePath("/coach/drills");
  return { ok: true as const };
}

export async function deleteDrill(id: string) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: c.error };
  if ("demo" in c) return { ok: true as const };
  // Soft delete: keeps the row (and any history) but pulls it out of the
  // bank the AI composes from.
  const { error } = await c.supabase
    .from("elite_drills")
    .update({ active: false })
    .eq("id", id);
  if (error) return { ok: false as const, error: "Couldn't remove the drill." };
  revalidatePath("/coach/drills");
  return { ok: true as const };
}
