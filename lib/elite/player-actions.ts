"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { getViewer } from "./session";

// Toggle a homework item's completion. Persists to Supabase in real mode;
// a safe no-op in demo mode (the UI keeps optimistic state).
export async function toggleHomework(id: string, completed: boolean) {
  const supabase = createClient();
  if (supabase) {
    await supabase
      .from("homework")
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
    await supabase.from("film_uploads").insert({
      player_id: viewer.playerId,
      title: input.title,
      url: input.url ?? null,
      status: "Uploaded",
    });
    revalidatePath("/film");
  }
  return { ok: true };
}

// Player replies to their coach.
export async function sendPlayerMessage(body: string) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false };
  const supabase = createClient();
  if (supabase) {
    await supabase.from("messages").insert({
      player_id: viewer.playerId,
      from_role: "player",
      from_name: viewer.profile.full_name,
      body,
    });
    revalidatePath("/dashboard");
  }
  return { ok: true };
}
