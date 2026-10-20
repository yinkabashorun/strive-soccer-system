// App error reports - the pure, client-safe half (no DB, no next/headers).
// The server half (recording and reading rows) is app-errors-server.ts,
// the same split as breaks.ts / breaks-server.ts.
//
// Oct 19 2026: a studio publish ended on an error page with every write
// already landed, and there was no record anywhere of what threw. These
// helpers shape what the error boundaries (app/error.tsx,
// app/global-error.tsx) send to /api/elite/errors so the next one leaves
// a row with its route, side, digest and message instead of nothing.

import type { AppError } from "./types";

export const ERROR_MESSAGE_MAX = 500;
export const ERROR_STACK_MAX = 4000;
export const ERROR_ROUTE_MAX = 300;

export type ErrorSide = "client" | "server";

export type ErrorReport = {
  side: ErrorSide;
  route: string;
  digest: string | null;
  message: string;
  stack: string | null;
};

// Path only. Query strings carry tokens (/auth/reset?token=...) and hashes
// carry nothing worth keeping, so neither is ever stored.
export function cleanRoute(href: string): string {
  const raw = String(href ?? "");
  const noHash = raw.split("#")[0];
  const noQuery = noHash.split("?")[0];
  let path = noQuery;
  try {
    if (/^https?:\/\//i.test(noQuery)) path = new URL(noQuery).pathname;
  } catch {
    path = noQuery;
  }
  if (!path.startsWith("/")) path = `/${path}`;
  return path.slice(0, ERROR_ROUTE_MAX);
}

function text(v: unknown, max: number): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  return s.length > max ? s.slice(0, max) : s;
}

// Shape a thrown error for the recorder. A server error reaches the
// client with a digest and a generic message (production strips the
// real one), so the digest is the key that finds it in the host logs and
// the stack is useless; a client error has no digest and its message and
// stack are the whole story.
export function errorReport(
  err: { message?: unknown; name?: unknown; stack?: unknown; digest?: unknown } | null | undefined,
  href: string
): ErrorReport {
  const digest = err && typeof err.digest === "string" && err.digest ? err.digest : null;
  const side: ErrorSide = digest ? "server" : "client";
  const message =
    text(err?.message, ERROR_MESSAGE_MAX) || text(err?.name, ERROR_MESSAGE_MAX) || "Unknown error";
  const stack = side === "client" ? text(err?.stack, ERROR_STACK_MAX) || null : null;
  return { side, route: cleanRoute(href), digest, message, stack };
}

// What the API route accepts from the browser: anything else is dropped,
// every field is capped, and the side is derived from the digest exactly
// as errorReport does so a report cannot claim to be something it isn't.
export function parseErrorReport(body: unknown): ErrorReport | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const message = text(b.message, ERROR_MESSAGE_MAX).trim();
  if (!message) return null;
  const digest = typeof b.digest === "string" && b.digest.trim() ? b.digest.trim().slice(0, 200) : null;
  const side: ErrorSide = digest ? "server" : "client";
  const stack = side === "client" ? text(b.stack, ERROR_STACK_MAX) || null : null;
  return { side, route: cleanRoute(text(b.route, ERROR_ROUTE_MAX * 2)), digest, message, stack };
}

export type AppErrorSummary = {
  last24h: number;
  last7d: number;
  latest: AppError | null;
};

export function summarizeAppErrors(rows: AppError[], now: number = Date.now()): AppErrorSummary {
  const day = 864e5;
  let last24h = 0;
  let last7d = 0;
  let latest: AppError | null = null;
  for (const r of rows) {
    const t = new Date(r.occurred_at).getTime();
    if (!Number.isFinite(t)) continue;
    const age = now - t;
    if (age <= day) last24h += 1;
    if (age <= 7 * day) last7d += 1;
    if (!latest || t > new Date(latest.occurred_at).getTime()) latest = r;
  }
  return { last24h, last7d, latest };
}
