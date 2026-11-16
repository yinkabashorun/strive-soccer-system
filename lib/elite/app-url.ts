// The one address every text, email and push links to.
//
// NEXT_PUBLIC_APP_URL in the deploy environment still pointed at the old
// strive-soccer-system.vercel.app address (seen Nov 12 2026 in the link
// preview of a real text). A family who taps that lands on a domain
// where they are not signed in. A *.vercel.app address, a non-https
// address or a value that is not an address at all is never used for a
// link we send: those fall back to the real domain.
export const CANONICAL_APP_URL = "https://thestriveapp.com";

export function resolveAppUrl(env: string | null | undefined): string {
  if (!env) return CANONICAL_APP_URL;
  try {
    const u = new URL(env.trim());
    if (u.protocol !== "https:") return CANONICAL_APP_URL;
    if (u.hostname === "vercel.app" || u.hostname.endsWith(".vercel.app")) return CANONICAL_APP_URL;
    return u.origin;
  } catch {
    return CANONICAL_APP_URL;
  }
}

export const APP_URL = resolveAppUrl(process.env.NEXT_PUBLIC_APP_URL);
