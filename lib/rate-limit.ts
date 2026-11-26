// Minimal in-memory rate limiter for public, unauthenticated endpoints
// (invite redemption, etc). Per-serverless-instance only - Vercel can run
// multiple instances, so a determined attacker spreading requests across
// them isn't fully stopped. That's a real gap (a shared store like Upstash
// Redis would close it), but this still raises the bar enormously above
// "zero throttling" for a single-instance or low-volume attack, with no
// new infra to set up. Revisit if abuse is ever actually observed.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Sweep old buckets occasionally so this map can't grow unbounded.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key);
  }
}

// Returns true if the request is allowed, false if the caller has
// exceeded `limit` attempts within `windowMs` for this key.
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count++;
  return true;
}

// Forget every count (the tests, which make many requests as one caller).
export function resetRateLimits() {
  buckets.clear();
}

// Best-effort client identifier behind Vercel's proxy.
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// HOW MANY SIGN-UPS ONE NETWORK ADDRESS MAY MAKE (Nov 26 2026).
//
// The free sign-up was held to 10 tries per 10 minutes per address, which
// is right for one home and wrong for a launch: at a tournament every
// player is on the venue's one Wi-Fi (and a phone carrier puts thousands
// of phones behind a few addresses), so the eleventh player to join in
// ten minutes was told "Too many attempts". A whole event has to be able
// to join from one address; a script still meets a ceiling.
export const JOIN_TRIES_PER_ADDRESS = 150;
export const JOIN_WINDOW_MS = 10 * 60_000;

// A signed-in caller is counted as THEMSELVES, not as their network
// address: forty teammates on one Wi-Fi are forty callers. The key is a
// short fingerprint of the sign-in token (never the token), so nothing
// secret sits in the limiter's memory.
export function callerKey(token: string): string {
  let a = 0x811c9dc5;
  let b = 0x1b873593;
  for (let i = 0; i < token.length; i++) {
    const c = token.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b + c, 0x85ebca6b) ^ (b >>> 13);
  }
  return `t:${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
}

// One address may carry many signed-in callers, but not without end: a
// script sending made-up tokens is still held, at this many times one
// caller's own limit.
export const ADDRESS_CEILING_FACTOR = 30;
