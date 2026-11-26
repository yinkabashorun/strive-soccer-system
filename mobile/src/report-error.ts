import Constants from "expo-constants";
import { api } from "@/api/client";
import { FIXTURES } from "@/config";

// WHAT BROKE ON A PLAYER'S PHONE REACHES THE COACHES (Nov 26 2026).
//
// The website has recorded every error page since Oct 20 (migration 039:
// the App errors card on /coach and the 6pm digest). The iPhone app
// recorded nothing: a screen that broke on a player's phone was invisible
// unless the player said so. Now a screen that cannot be drawn, and an
// error nothing caught, are sent to the same recorder with the build
// number and the screen it happened on. No name, no photo, nothing the
// player typed: the error's own words and where it was.
//
// Best effort, always: a report that cannot be sent is dropped, and a
// failure here never becomes a second error.
let where = "";

// The screen the app is on, kept by the gatekeeper (app/_layout.tsx), so
// a report can say where it happened without asking a broken screen.
export function noteScreen(segments: readonly string[]) {
  where = segments.join("/");
}

// "/iphone/10/club/[id]": the build, then the screen. The recorder keeps
// the path only and caps every field (lib/elite/app-errors.ts).
export function reportRoute(build: string | null | undefined, screen: string): string {
  const b = typeof build === "string" && /^\d{1,6}$/.test(build) ? build : "0";
  const s = screen.replace(/[^A-Za-z0-9\-_/()[\]]/g, "").slice(0, 120);
  return `/iphone/${b}/${s}`;
}

const sent = new Set<string>();

export function reportAppError(error: unknown, kind: "screen" | "uncaught") {
  if (FIXTURES) return;
  try {
    const e = error as { message?: unknown; name?: unknown; stack?: unknown } | null;
    const message = String(e?.message ?? e?.name ?? error ?? "Unknown error").slice(0, 480);
    const route = reportRoute(Constants.expoConfig?.ios?.buildNumber, where);
    // the same error on the same screen is said once per open of the app
    const key = `${route}|${message}`;
    if (sent.has(key) || sent.size >= 10) return;
    sent.add(key);
    const stack = typeof e?.stack === "string" ? e.stack.slice(0, 3900) : null;
    void api("/api/elite/errors", {
      method: "POST",
      open: true,
      timeoutMs: 8000,
      body: { message: `[${kind}] ${message}`, stack, route },
    }).catch(() => undefined);
  } catch {
    // never a second error
  }
}

// An error nothing caught (a tap handler, a timer): reported, then handed
// to whatever was handling it before, unchanged.
type Handler = (error: unknown, isFatal?: boolean) => void;
type Utils = { getGlobalHandler?: () => Handler; setGlobalHandler?: (h: Handler) => void };
let installed = false;

export function reportUncaught() {
  if (installed) return;
  installed = true;
  const utils = (globalThis as { ErrorUtils?: Utils }).ErrorUtils;
  if (!utils?.setGlobalHandler) return;
  const before = utils.getGlobalHandler?.();
  utils.setGlobalHandler((error, isFatal) => {
    reportAppError(error, "uncaught");
    before?.(error, isFatal);
  });
}
