import { AsyncLocalStorage } from "node:async_hooks";

// The native iPhone app (mobile/) signs in with Supabase on the phone and
// calls the site's JSON API (app/api/app/*) with its access token in an
// `Authorization: Bearer <token>` header, because a React Native app has
// no cookie jar and cannot call Next server actions.
//
// Every business rule in this codebase reads the signed-in person through
// two functions: createClient() (lib/elite/supabase/server.ts) and
// getViewer() (lib/elite/session.ts). Rather than a second copy of those
// rules for the app, an API route runs its handler inside runWithBearer:
// for the length of that one request, createClient() builds a client that
// carries the phone's token instead of reading cookies, and getViewer()
// verifies that token with Supabase (auth.getUser(token)). Nothing outside
// that call sees the token: the store is per request (AsyncLocalStorage),
// so the website's cookie requests are untouched.
//
// A bearer header is never sent by a browser on its own (unlike a cookie),
// so this path carries no cross-site request risk.

type BearerStore = { token: string };

const store = new AsyncLocalStorage<BearerStore>();

export function runWithBearer<T>(token: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ token }, fn);
}

// The token of the native request being served, or null for every other
// request (the website, crons, webhooks).
export function bearerToken(): string | null {
  return store.getStore()?.token ?? null;
}

// A Supabase access token is a JWT: three base64url parts. Anything else
// in the header is refused before it reaches Supabase.
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export const MAX_TOKEN_LENGTH = 4096;

export function parseBearer(header: string | null | undefined): string | null {
  if (typeof header !== "string") return null;
  const m = header.trim().match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const token = m[1];
  if (token.length > MAX_TOKEN_LENGTH || !JWT.test(token)) return null;
  return token;
}
