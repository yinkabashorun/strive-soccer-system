import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Strive OS is designed to run on Supabase: players, sessions, leads,
// content, payments, and progress all map cleanly to Postgres tables.
//
// Tables (suggested):
//   players          (mirrors lib/types.ts:Player)
//   sessions         (mirrors lib/types.ts:Session)
//   session_attendance (player_id, session_id, attended, note)
//   leads            (mirrors lib/types.ts:Lead) — populated from GHL webhooks
//   content_items    (mirrors lib/types.ts:ContentItem)
//   coach_tasks      (mirrors lib/types.ts:CoachTask)
//   payments         (player_id, amount, status, stripe_session_id)
//   ghl_sync_log     (id, type, payload, received_at)

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  _client = createClient(url, key);
  return _client;
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
