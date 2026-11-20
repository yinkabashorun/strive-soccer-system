"use client";

import { createClient } from "./supabase/client";
import { CLIP_BUCKET, MAX_CLIP_MB } from "./clips";
import { holdRefresh } from "./fresh";
import { keepAwake } from "./native";
import { resumableUpload } from "./resumable-upload";

// Browser-side upload into the private elite-film bucket (storage RLS
// scopes the path to the family's own folder, 036/037/062). Shared by Send
// a clip, the progress video and Film Room so the rules live once: size
// cap, content type, one plain error line a player can act on.
//
// Since Nov 20 2026 (punch list A26) a clip goes up in resumable pieces
// with the percent shown, the screen stays on until it is done, and a
// dropped connection picks up where it stopped. A plain upload is the
// fallback when the resumable one cannot start.
export const UPLOAD_FAILED = "Upload didn't go through. Check your connection and try again.";

export async function uploadClip(
  file: File,
  path: string,
  onProgress?: (percent: number) => void
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (file.size > MAX_CLIP_MB * 1024 * 1024) {
    return { ok: false, error: `That clip is over ${MAX_CLIP_MB}MB. Film a shorter one.` };
  }
  const supabase = createClient();
  if (!supabase) return { ok: false, error: "Clips send from the live app." };
  const contentType = file.type || "video/mp4";
  // The page is not redrawn while a clip is on its way up (fresh.ts), and
  // the phone does not sleep in the middle of it.
  const letRefresh = holdRefresh();
  const letSleep = keepAwake();
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (url && anonKey && accessToken) {
      const done = await resumableUpload({
        auth: { supabaseUrl: url, anonKey, accessToken },
        bucket: CLIP_BUCKET,
        path,
        file,
        contentType,
        onProgress,
      });
      if (done) {
        onProgress?.(100);
        return { ok: true };
      }
    }
    const { error } = await supabase.storage
      .from(CLIP_BUCKET)
      .upload(path, file, { contentType, cacheControl: "3600" });
    if (error) return { ok: false, error: UPLOAD_FAILED };
    onProgress?.(100);
    return { ok: true };
  } finally {
    letSleep();
    letRefresh();
  }
}
