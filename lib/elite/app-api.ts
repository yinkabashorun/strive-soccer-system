// The native iPhone app's JSON API (app/api/app/*), the one way in.
//
// Every route is built with appRoute(): the phone's Supabase access token
// comes in the Authorization header (never the body), the request runs
// inside runWithBearer so the SAME getViewer() and createClient() every
// web page and server action uses see that token (lib/elite/supabase/
// bearer.ts), and the SAME member gate the web member shell uses
// (lib/elite/member-gate.ts) decides who may call what. The handlers then
// call the existing lib/elite functions and server actions; no business
// rule is written twice for the app.
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { parseBearer, runWithBearer } from "./supabase/bearer";
import { getViewer, type Viewer } from "./session";
import { getPlayer } from "./data";
import { consentDue } from "./legal-server";
import { getTracker } from "./tracker-server";
import { memberState, type MemberState } from "./member-gate";
import type { Player } from "./types";

// Who may call a route:
//   account  any signed-in account (sign-in state, the agreement, change
//            password, delete the account)
//   player   a player with a member record who has accepted the agreement
//            (the quiz, the first-week build, this phone's push token)
//   member   in the member app (the gate says "ok"): the week, a drill
//            done, Extra work, the check-in, You
export type AppAccess = "account" | "player" | "member";

export type AppContext = {
  req: Request;
  viewer: Viewer;
  state: MemberState;
  player: Player | null;
};

export type AppRouteOptions = {
  name: string;
  access: AppAccess;
  // Requests per window per caller. Reads default to 120 a minute, writes
  // to 60; the two that check a password are held much tighter.
  limit?: number;
  windowMs?: number;
};

export const SIGNED_OUT = { error: "signed_out" } as const;
export const SLOW_DOWN = { error: "slow_down" } as const;

export function appJson(body: unknown, status = 200): Response {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

// Whether a member state may use a route of a given access level.
export function accessAllowed(access: AppAccess, state: MemberState): boolean {
  if (access === "account") return true;
  if (access === "player") return state.kind !== "coach" && state.kind !== "free" && state.kind !== "no_profile" && state.kind !== "consent";
  return state.kind === "ok";
}

// The member state of a signed-in viewer, read with the same calls the web
// member shell makes.
export async function loadMemberState(viewer: Viewer): Promise<{ state: MemberState; player: Player | null }> {
  if (viewer.role !== "player") return { state: { kind: "coach" }, player: null };
  if (!viewer.playerId) {
    const tracker = await getTracker(viewer.profile.id).catch(() => null);
    return { state: memberState({ role: viewer.role, playerId: null, isFree: Boolean(tracker), consentDue: false, player: null }), player: null };
  }
  const [player, due] = await Promise.all([getPlayer(viewer.playerId), consentDue(viewer.profile.id)]);
  return {
    state: memberState({ role: viewer.role, playerId: viewer.playerId, isFree: false, consentDue: due, player }),
    player,
  };
}

export function appRoute(
  opts: AppRouteOptions,
  handler: (ctx: AppContext) => Promise<unknown>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const write = req.method !== "GET";
    const limit = opts.limit ?? (write ? 60 : 120);
    if (!rateLimit(`app:${opts.name}:${clientIp(req)}`, limit, opts.windowMs ?? 60_000)) {
      return appJson(SLOW_DOWN, 429);
    }
    const token = parseBearer(req.headers.get("authorization"));
    if (!token) return appJson(SIGNED_OUT, 401);

    return runWithBearer(token, async () => {
      const viewer = await getViewer();
      if (!viewer || viewer.demo) return appJson(SIGNED_OUT, 401);
      const { state, player } = await loadMemberState(viewer);
      if (!accessAllowed(opts.access, state)) return appJson({ error: "gate", state }, 403);
      try {
        const out = await handler({ req, viewer, state, player });
        return out instanceof Response ? out : appJson(out);
      } catch (e) {
        // A redirect or not-found thrown by a shared server action is a web
        // navigation, never something to hand the phone.
        const digest = (e as { digest?: unknown })?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_")) return appJson({ error: "unavailable" }, 409);
        return appJson({ error: "server" }, 500);
      }
    });
  };
}

// A JSON body, or null when it is not one. Bodies are capped so a phone
// can never send the server something large.
export const MAX_BODY_BYTES = 64 * 1024;
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY_BYTES) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
