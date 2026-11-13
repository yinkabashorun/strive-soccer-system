import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { freshFetch } from "./fresh-fetch";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Server Supabase client for Strive Elite (server components, route
// handlers, server actions). Reads/writes the auth cookie jar.
// Returns null when Supabase is not configured (demo mode).
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = cookies();
  return createServerClient(url, key, {
    global: { fetch: freshFetch }, // never Next's fetch cache (fresh-fetch.ts)
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore. The session
          // is refreshed by the middleware on the next request.
        }
      },
    },
  });
}

// Service-role client for privileged server work (webhooks, admin writes,
// coach bootstrap). A true admin client — no user cookies — so it reliably
// bypasses RLS. Never expose this to the browser.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createAdminClient(url, serviceKey, {
    global: { fetch: freshFetch }, // never Next's fetch cache (fresh-fetch.ts)
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
