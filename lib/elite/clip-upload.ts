"use client";

import { createClient } from "./supabase/client";
import { CLIP_BUCKET, MAX_CLIP_MB } from "./clips";

// Browser-side upload into the private elite-film bucket (storage RLS
// scopes the path to the family's own folder, 036/037). Shared by Send a
// clip and the progress video so the rules live once: size cap, content
// type, one plain error line a player can act on.
export async function uploadClip(file: File, path: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (file.size > MAX_CLIP_MB * 1024 * 1024) {
    return { ok: false, error: `That clip is over ${MAX_CLIP_MB}MB. Film a shorter one.` };
  }
  const supabase = createClient();
  if (!supabase) return { ok: false, error: "Clips send from the live app." };
  const { error } = await supabase.storage
    .from(CLIP_BUCKET)
    .upload(path, file, { contentType: file.type || "video/mp4", cacheControl: "3600" });
  if (error) return { ok: false, error: "Upload didn't go through. Check your connection and try again." };
  return { ok: true };
}
