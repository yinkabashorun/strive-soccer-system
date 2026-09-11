"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { getViewer } from "./session";
import { PLYO_PILLAR, PROGRESS_METRICS } from "./types";

export type DrillInput = {
  id?: string; // present = update, absent = create
  pillar: string;
  title: string;
  how: string;
  reps: string;
  minutes: number;
  cues: string;
  needs_wall: boolean;
  video_url: string;
  demo_by: string;
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

  const pillar =
    input.pillar === PLYO_PILLAR ||
    (PROGRESS_METRICS as readonly string[]).includes(input.pillar)
      ? input.pillar
      : "Ball Mastery";
  // Plyo titles get the standard prefix so the player UI badges them as
  // warm-ups ("Plyo warm-up: Pogo & Tuck") without the coach typing it.
  let title = input.title.trim().slice(0, 120);
  if (pillar === PLYO_PILLAR && title && !/plyo|warm.?up/i.test(title)) {
    title = `Plyo warm-up: ${title}`.slice(0, 120);
  }
  const row = {
    pillar,
    title,
    how: input.how.trim().slice(0, 600),
    reps: input.reps.trim().slice(0, 120),
    minutes: Math.max(3, Math.min(30, Math.round(input.minutes) || 10)),
    cues: input.cues.trim().slice(0, 240),
    needs_wall: Boolean(input.needs_wall),
    video_url: /^https?:\/\/.+/.test(input.video_url.trim())
      ? input.video_url.trim().slice(0, 500)
      : "",
    demo_by: input.demo_by.trim().slice(0, 80),
  };
  if (!row.title) return { ok: false as const, error: "Give the drill a name." };

  const write = (r: object) =>
    input.id
      ? c.supabase.from("elite_drills").update(r).eq("id", input.id)
      : c.supabase.from("elite_drills").insert(r);
  let { error } = await write(row);
  if (error) {
    // pre-021 (no video columns): save the rest so editing never blocks
    const { video_url: _v, demo_by: _d, ...legacy } = row;
    ({ error } = await write(legacy));
  }
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
