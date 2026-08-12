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
    revalidatePath("/dashboard");
  }
  return { ok: true };
}
