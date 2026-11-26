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
import { ADDRESS_CEILING_FACTOR, callerKey, clientIp, rateLimit } from "@/lib/rate-limit";
import { parseBearer, runWithBearer } from "./supabase/bearer";
import { getViewer, type Viewer } from "./session";
import { getPlayer } from "./data";
import { consentDue } from "./legal-server";
import { getTracker, type Tracker } from "./tracker-server";
import { readIntake, stageOf, type StoredIntake } from "./free-intake-server";
import { mayHaveFreeApp, memberState, type MemberState } from "./member-gate";
import { ensureFreeApp } from "./pro-social-server";
import { profileSetupDue } from "./account-profile";
import type { Player } from "./types";

// Who may call a route:
//   account  any signed-in account (sign-in state, the agreement, change
//            password, delete the account)
//   player   a player with a member record who has accepted the agreement
//            (the quiz, the first-week build, this phone's push token)
//   member   in the member app (the gate says "ok"): the week, a drill
//            done, Extra work, the check-in, You
//   person   a player account of either kind, a member or a free account,
//            that has accepted the agreement: its own photo, its
//            @username, this phone's push token
//   free     a free account (069) the app can serve: the week's set-up
//            and an earned month. A Strive Pro member who came through
//            the free app keeps these (lib/elite/one-app.ts).
//   free_only a free account with NO membership on: the quiz, the offer
//            and starting Strive Pro. Refused once Strive Pro is on, so a
//            member can never be sent to a second checkout.
//   free_app in the free app itself (the set-up is finished and the photo
//            and @username are in, as the website's free shell requires):
//            the feed, posting, the week, friends
export type AppAccess = "account" | "player" | "member" | "person" | "free" | "free_only" | "free_app";

export type AppContext = {
  req: Request;
  viewer: Viewer;
  state: MemberState;
  player: Player | null;
  // the free account behind this viewer and its quiz: a free account
  // (state.kind is "free"), and a Strive Pro member who keeps the free app
  // (state ok + social)
  tracker: Tracker | null;
  intake: StoredIntake | null;
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
export function accessAllowed(access: AppAccess, state: MemberState, setupDue = false): boolean {
  if (access === "account") return true;
  const player = state.kind !== "coach" && state.kind !== "free" && state.kind !== "no_profile" && state.kind !== "consent";
  const free = state.kind === "free" && state.stage !== "web";
  // a member who also has the free app keeps every free route (one-app.ts)
  const social = state.kind === "ok" && state.social === true;
  if (access === "player") return player;
  if (access === "person") return player || state.kind === "free";
  if (access === "free_only") return free;
  if (access === "free") return free || social;
  if (access === "free_app") return (free && state.stage === "ready" && !setupDue) || (social && !setupDue);
  return state.kind === "ok";
}

type Loaded = { state: MemberState; player: Player | null; tracker: Tracker | null; intake: StoredIntake | null };

// The member state of a signed-in viewer, read with the same calls the web
// member shell makes. The free account is read when there is no member
// row, and for a Strive Pro row whose membership is not on (a free account
// that tapped Start and has not paid still lives in the free app).
export async function loadMemberState(viewer: Viewer): Promise<Loaded> {
  if (viewer.role !== "player") return { state: { kind: "coach" }, player: null, tracker: null, intake: null };
  const freeSide = async (): Promise<{ tracker: Tracker | null; intake: StoredIntake | null }> => {
    const tracker = await getTracker(viewer.profile.id).catch(() => null);
    const intake = tracker ? await readIntake(viewer.profile.id).catch(() => null) : null;
    return { tracker, intake };
  };
  if (!viewer.playerId) {
    const { tracker, intake } = await freeSide();
    const state = memberState({
      role: viewer.role,
      playerId: null,
      isFree: Boolean(tracker),
      freeStage: tracker && intake ? stageOf(tracker, intake) : "web",
      consentDue: false,
      player: null,
    });
    return { state, player: null, tracker, intake };
  }
  const [player, due] = await Promise.all([getPlayer(viewer.playerId), consentDue(viewer.profile.id)]);
  // The free account is read for every Strive Pro row: one whose
  // membership is not on still lives in the free app, and one whose
  // membership IS on keeps the free app and gains the Train tab.
  let { tracker, intake } = mayHaveFreeApp(player) ? await freeSide() : { tracker: null, intake: null };
  // EVERY MEMBER HAS THE WHOLE APP (lib/elite/one-app.ts
  // getsFreeApp): one who bought Strive Pro straight away gets the free
  // app's side made here, once, and is then a free player who upgraded.
  if (!tracker && !due) {
    tracker = await ensureFreeApp(viewer.profile.id, player);
    if (tracker) intake = await readIntake(viewer.profile.id).catch(() => null);
  }
  const state = memberState({
    role: viewer.role,
    playerId: viewer.playerId,
    isFree: Boolean(tracker),
    freeStage: tracker && intake ? stageOf(tracker, intake) : "web",
    hasFreeApp: Boolean(tracker),
    consentDue: due,
    player,
  });
  const keepsFree = state.kind === "free" || (state.kind === "ok" && state.social === true);
  return { state, player, tracker: keepsFree ? tracker : null, intake: keepsFree ? intake : null };
}

export function appRoute(
  opts: AppRouteOptions,
  handler: (ctx: AppContext) => Promise<unknown>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const write = req.method !== "GET";
    const limit = opts.limit ?? (write ? 60 : 120);
    const windowMs = opts.windowMs ?? 60_000;
    const token = parseBearer(req.headers.get("authorization"));
    // A signed-in caller is limited as themselves, never as their network
    // address: a whole team opens the app on one Wi-Fi (lib/rate-limit.ts).
    // The address keeps a far higher ceiling, so made-up tokens are held.
    const ip = clientIp(req);
    if (!rateLimit(`app:${opts.name}:ip:${ip}`, token ? limit * ADDRESS_CEILING_FACTOR : limit, windowMs)) {
      return appJson(SLOW_DOWN, 429);
    }
    if (!token) return appJson(SIGNED_OUT, 401);
    if (!rateLimit(`app:${opts.name}:${callerKey(token)}`, limit, windowMs)) return appJson(SLOW_DOWN, 429);

    return runWithBearer(token, async () => {
      const viewer = await getViewer();
      if (!viewer || viewer.demo) return appJson(SIGNED_OUT, 401);
      const { state, player, tracker, intake } = await loadMemberState(viewer);
      if (!accessAllowed(opts.access, state, profileSetupDue(viewer.setup))) return appJson({ error: "gate", state }, 403);
      try {
        const out = await handler({ req, viewer, state, player, tracker, intake });
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

// A route with nobody signed in yet: whether free sign-up is open, and the
// sign-up itself. Rate limited by caller like every other route; it reads
// no token and resolves no viewer.
export function publicAppRoute(
  opts: { name: string; limit?: number; windowMs?: number },
  handler: (req: Request) => Promise<unknown>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const limit = opts.limit ?? (req.method === "GET" ? 120 : 20);
    if (!rateLimit(`app:${opts.name}:${clientIp(req)}`, limit, opts.windowMs ?? 60_000)) {
      return appJson(SLOW_DOWN, 429);
    }
    try {
      const out = await handler(req);
      return out instanceof Response ? out : appJson(out);
    } catch {
      return appJson({ error: "server" }, 500);
    }
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
