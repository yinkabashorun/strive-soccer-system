import type { AppBootstrap, AppMemberState } from "@shared/app-contract";
import { nativeRouteFor } from "@shared/notice-routes";
import { NOTICE_TOPICS, type NoticeTopic } from "@shared/notices";
import { firstTab, type OneAppTabKey } from "@shared/one-app";

// Where the app belongs for who is signed in, the same order as the
// website's member shell (app/(player)/layout.tsx, lib/elite/member-gate.ts),
// as screen groups:
//   sign-in     nobody is signed in (and joining free, before an account
//               exists)
//   agreement   "Before you train", once
//   profile     the photo and the @username (081), whoever owes them: a
//               new member BEFORE "You're in" (the member card there
//               carries their photo), a new free account FIRST, before
//               the code and the quiz (a friend request and a club
//               request carry the photo, and the offer shows their card),
//               and a member from before 081 once, before the app
//   onboarding  the door, the quiz, building
//   gate        a screen that says what is happening and what is next
//   app         the member tabs and everything one tap from them
//   free-quiz   a free account that has not taken the quiz: THE DOOR
//               first ("Have a code from a teammate or a club?",
//               lib/elite/free-door.ts: a real code goes straight to the
//               free app and the quiz waits), then the same quiz
//   free-offer  a free account after the quiz: the offer, then the week's
//               set-up (a target and the days)
//   free        the free tabs and everything one tap from them. ONE APP
//               (lib/elite/one-app.ts): a Strive Pro member who came
//               through the free app lives here too, with every free tab
//               and one more, Train. Upgrading never moves them to another
//               set of tabs and never takes their friends or clubs away.
// Pure, tested in tests/logic.test.ts.
export type Area = "sign-in" | "agreement" | "onboarding" | "gate" | "profile" | "app" | "free-quiz" | "free-offer" | "free";

export function areaFor(
  signedIn: boolean,
  state: AppMemberState | null | undefined,
  setup?: AppBootstrap["profileSetup"]
): Area | null {
  if (!signedIn) return "sign-in";
  if (!state) return null; // still reading who this is: stay where we are
  const owed = Boolean(setup && setup.steps.length > 0);
  switch (state.kind) {
    case "ok":
      if (owed) return "profile";
      // a member with the free app behind them keeps it, and gains Train
      return state.social ? "free" : "app";
    case "consent":
      return "agreement";
    case "onboarding":
      // the photo comes first, so the door's card has one to show
      return owed ? "profile" : "onboarding";
    case "free":
      // the quiz cannot be stored yet: the free app is the website's
      if (state.stage === "web") return "gate";
      // the photo and the @username come first for a free account: before
      // the door's code, the quiz, the offer and the free app
      if (owed) return "profile";
      if (state.stage === "quiz") return "free-quiz";
      return state.stage === "offer" ? "free-offer" : "free";
    default:
      return "gate";
  }
}

// The first route segment of each area, as the router reports it.
export const AREA_ROOT: Record<Area, string> = {
  "sign-in": "sign-in",
  agreement: "agreement",
  onboarding: "onboarding",
  gate: "gate",
  profile: "profile-setup",
  app: "(tabs)",
  "free-quiz": "onboarding",
  "free-offer": "offer",
  free: "(free)",
};

// Strive Pro is on for someone who lives in the free tabs: they have Train.
export function hasTrain(state: AppMemberState | null | undefined): boolean {
  return state?.kind === "ok" && state.social === true;
}

// Who the free app's data is for: a free account, and a Strive Pro member
// who came through it. The second one is why no screen may ask "is this a
// free account?" before loading Friends, Week, Clubs or You: they are the
// same tabs and must load the same way.
export function hasFreeApp(state: AppMemberState | null | undefined, stage?: "ready"): boolean {
  if (hasTrain(state)) return true;
  if (state?.kind !== "free") return false;
  return stage ? state.stage === stage : true;
}

// The screen of each tab of the one app, by the key the shared rule uses.
export const ONE_APP_ROUTE: Record<OneAppTabKey, string> = {
  train: "/(free)/train",
  friends: "/(free)/friends",
  week: "/(free)/my-week",
  clubs: "/(free)/clubs",
  you: "/(free)/me",
};

// Where the gatekeeper sends someone who is outside their area. `train`:
// this person has the Train tab (a Pro member opens the app to train).
export function areaHome(area: Area, train = false): string {
  if (area === "app") return "/";
  if (area === "free") return ONE_APP_ROUTE[firstTab(train)];
  return `/${AREA_ROOT[area]}`;
}

// Home for whoever is signed in, for a screen that has nowhere to go back to.
export function homeOf(state: AppMemberState | null | undefined): string {
  return state?.kind === "free" || hasTrain(state) ? areaHome("free", hasTrain(state)) : "/";
}

// Routes outside the tabs that still belong to the app area (the Inbox,
// and the profile screens: changing the photo or the username from
// Settings).
const APP_ROUTES = new Set(["(tabs)", "session", "course", "drop", "extra", "checkin", "inbox", "settings", "change-password", "delete-account", "profile-setup"]);
// The same for the free app: posting, the offer (opened from the one card
// on Week, or a locked course), the week's set-up, a club and everything
// one tap from it, a friend's profile, the blocked list, and the profile
// screens.
const FREE_ROUTES = new Set(["(free)", "post", "offer", "week-plan", "club", "player", "blocked", "settings", "change-password", "delete-account", "profile-setup"]);
// What Strive Pro adds to the free tabs, one tap from Train: the session,
// the Monday drop, extra work, the check-in, a course and the Inbox.
const TRAIN_ROUTES = new Set(["session", "drop", "extra", "checkin", "course", "inbox"]);
// After the quiz and before the free app: the offer, then the week's set-up.
const FREE_OFFER_ROUTES = new Set(["offer", "week-plan"]);
// Signed out: the sign-in screen, and joining free one question a screen.
const SIGNED_OUT_ROUTES = new Set(["sign-in", "join"]);
// Account pages any signed-in person can reach from a gate or the agreement
// (App Review 5.1.1(v): deleting the account is never behind the gate).
const ALWAYS = new Set(["settings", "change-password", "delete-account"]);

export function inArea(area: Area, segments: readonly string[], train = false): boolean {
  const seg = segments[0] ?? "";
  if (area === "sign-in") return SIGNED_OUT_ROUTES.has(seg);
  if (ALWAYS.has(seg)) return true;
  // The building screen finishes what the quiz started, whatever the gate
  // says once the quiz is saved (a Pro member is in at once; an Elite
  // family waits for the coach, and the screen says so).
  if (seg === "onboarding" && segments[1] === "building") return true;
  if (area === "app") return APP_ROUTES.has(seg) || seg === "";
  // A free player who came in by the door takes the quiz later, from the
  // one card on Week: the quiz's screens open over the free app for them.
  // Never for a member (their quiz is behind them).
  if (area === "free" && seg === "onboarding") return !train;
  if (area === "free") return FREE_ROUTES.has(seg) || (train && TRAIN_ROUTES.has(seg));
  if (area === "free-offer") return FREE_OFFER_ROUTES.has(seg);
  if (area === "onboarding" || area === "free-quiz") return seg === "onboarding";
  return seg === AREA_ROOT[area];
}

// Where a tapped notification opens: the page the notice names, as a
// screen of this app. ONE map, lib/elite/notice-routes.ts, shared with the
// Inbox's rows: a new week and a reminder open Home, a medal opens You,
// anything from the coach opens the Inbox (the app has no Coach screens
// yet), a friend's post opens Friends, a club's session or game opens that
// club. Before Nov 24 2026 everything opened Home.
//
// Someone who is not in the app or the free app yet (the agreement, a
// gate, the quiz) is sent where they belong instead; a notice never jumps
// a gate.
export function pushRoute(area: Area | null, url: unknown, topic?: unknown, train = false): string {
  if (!area) return "/";
  if (area !== "app" && area !== "free") return areaHome(area);
  const t = (NOTICE_TOPICS as readonly unknown[]).includes(topic) ? (topic as NoticeTopic) : null;
  return nativeRouteFor(url, area === "app" ? "member" : train ? "social" : "free", t);
}

// What a tapped notification carries. The site sends straight to Apple
// (lib/elite/apns.ts), so the address and the topic ride beside `aps` in
// the payload as Apple delivers it, which the notifications library hands
// over under trigger.payload (its own `data` is filled only by its own
// relay, which we do not use; it is read as a fallback all the same).
//
// `open`: a notice the PHONE gave itself names a screen of the app instead
// (the one there is: "clock", the training clock left running,
// src/clock-nudge.ts).
export type TappedNotice = { url: unknown; topic: unknown; open?: unknown };

export function tappedNotice(res: unknown): TappedNotice {
  const request = (res as { notification?: { request?: { trigger?: unknown; content?: { data?: unknown } } } } | null)?.notification?.request;
  const payload = (request?.trigger as { payload?: Record<string, unknown> | null } | null | undefined)?.payload ?? null;
  const data = (request?.content?.data as Record<string, unknown> | null | undefined) ?? null;
  return { url: payload?.url ?? data?.url, topic: payload?.topic ?? data?.topic, open: data?.open };
}

// Where a notice the phone gave itself opens. The clock's is the only one:
// it opens the clock, for whoever has the free app. Null for anything else.
export const LOCAL_CLOCK = "clock";
export function localRoute(area: Area | null, notice: TappedNotice): string | null {
  return area === "free" && notice.open === LOCAL_CLOCK ? "/post" : null;
}
