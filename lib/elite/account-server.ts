// Removing a player's files from the private film bucket. Server only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { FILM_BUCKET, playerFilePrefixes } from "./account";

// Storage has folders only as path prefixes, so a folder is emptied by
// walking it: list a level, remove the files, descend into what is left.
async function emptyFolder(admin: SupabaseClient, prefix: string, depth = 0): Promise<number> {
  if (depth > 4) return 0; // the deepest real path is three levels
  let removed = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(FILM_BUCKET).list(prefix, { limit: 1000 });
    if (error || !data || data.length === 0) break;
    const files = data.filter((e) => e.id !== null).map((e) => `${prefix}/${e.name}`);
    const folders = data.filter((e) => e.id === null).map((e) => `${prefix}/${e.name}`);
    for (const f of folders) removed += await emptyFolder(admin, f, depth + 1);
    if (files.length > 0) {
      const { error: rmError } = await admin.storage.from(FILM_BUCKET).remove(files);
      if (rmError) break;
      removed += files.length;
    }
    // A full page of files may have more behind it; folders never do once emptied.
    if (files.length < 1000) break;
  }
  return removed;
}

// Every clip, progress video and Film Room clip a player ever uploaded.
// Best effort per folder: a storage hiccup never blocks the deletion of
// the account itself, and the count is returned for the record.
export async function removePlayerFiles(admin: SupabaseClient, playerId: string): Promise<number> {
  let removed = 0;
  for (const prefix of playerFilePrefixes(playerId)) {
    removed += await emptyFolder(admin, prefix).catch(() => 0);
  }
  return removed;
}
