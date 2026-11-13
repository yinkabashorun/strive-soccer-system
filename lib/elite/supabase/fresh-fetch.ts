// Every database read in this app must come from the database, never
// from Next's fetch cache.
//
// Next 14 caches a server-side GET fetch by default ("auto cache") unless
// the request has already been marked dynamic. A route handler that
// exports `dynamic = "force-dynamic"` is NOT marked that way: Next skips
// the request proxy that would have done it, so every Supabase read made
// through the service client in such a route was stored in the Data
// Cache with no expiry and replayed on later runs. That is how the
// hourly plan builder kept reading "latest built week = 7" for the first
// player on the roster after week 8 existed, rebuilt week 8 every hour,
// wiped its checkmarks and texted the family each time (Nov 2026: 117
// times for one profile, 94 for another).
//
// Passing this as `global.fetch` to every server-side Supabase client
// sets `cache: "no-store"` on each request, which Next honors ahead of
// every default. One place, every client, every route.
export const freshFetch: typeof fetch = (input, init) =>
  fetch(input, { ...(init ?? {}), cache: "no-store" });
