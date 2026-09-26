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

// Best-effort client identifier behind Vercel's proxy.
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
