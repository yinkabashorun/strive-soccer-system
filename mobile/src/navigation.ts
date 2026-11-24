import type { AppBootstrap, AppMemberState } from "@shared/app-contract";

// Where the app belongs for who is signed in, the same order as the
// website's member shell (app/(player)/layout.tsx, lib/elite/member-gate.ts),
// as screen groups:
//   sign-in     nobody is signed in (and joining free, before an account
//               exists)
//   agreement   "Before you train", once
//   profile     the photo and the @username (081), whoever owes them: a
//               new member BEFORE the door (the member card on the door
//               carries their photo), a free account after its quiz and
//               before the offer (the offer shows their card), and a
//               member from before 081 once, before the app
//   onboarding  the door, the quiz, building
//   gate        a screen that says what is happening and what is next
//   app         the member tabs and everything one tap from them
//   free-quiz   a free account that has not taken the quiz: the same quiz
//   free-offer  a free account after the quiz: the offer, then the week's
//               set-up (a target and the days)
//   free        the free tabs and everything one tap from them
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
      return owed ? "profile" : "app";
    case "consent":
      return "agreement";
    case "onboarding":
      // the photo comes first, so the door's card has one to show
      return owed ? "profile" : "onboarding";
    case "free":
      // the quiz cannot be stored yet: the free app is the website's
      if (state.stage === "web") return "gate";
      if (state.stage === "quiz") return "free-quiz";
      // after the quiz, the photo comes before the offer and the free app
      if (owed) return "profile";
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

// Where the gatekeeper sends someone who is outside their area.
export function areaHome(area: Area): string {
  if (area === "app") return "/";
  if (area === "free") return "/(free)/friends";
  return `/${AREA_ROOT[area]}`;
}

// Routes outside the tabs that still belong to the app area (the profile
// screens too: changing the photo or the username from Settings).
const APP_ROUTES = new Set(["(tabs)", "session", "course", "drop", "extra", "checkin", "settings", "change-password", "delete-account", "profile-setup"]);
// The same for the free app: posting, the offer (opened from the one card
// on Week, or a locked course), the week's set-up, a club and everything
// one tap from it, and the profile screens.
const FREE_ROUTES = new Set(["(free)", "post", "offer", "week-plan", "club", "settings", "change-password", "delete-account", "profile-setup"]);
// After the quiz and before the free app: the offer, then the week's set-up.
const FREE_OFFER_ROUTES = new Set(["offer", "week-plan"]);
// Signed out: the sign-in screen, and joining free one question a screen.
const SIGNED_OUT_ROUTES = new Set(["sign-in", "join"]);
// Account pages any signed-in person can reach from a gate or the agreement
// (App Review 5.1.1(v): deleting the account is never behind the gate).
const ALWAYS = new Set(["settings", "change-password", "delete-account"]);

export function inArea(area: Area, segments: readonly string[]): boolean {
  const seg = segments[0] ?? "";
  if (area === "sign-in") return SIGNED_OUT_ROUTES.has(seg);
  if (ALWAYS.has(seg)) return true;
  // The building screen finishes what the quiz started, whatever the gate
  // says once the quiz is saved (a Pro member is in at once; an Elite
  // family waits for the coach, and the screen says so).
  if (seg === "onboarding" && segments[1] === "building") return true;
  if (area === "app") return APP_ROUTES.has(seg) || seg === "";
  if (area === "free") return FREE_ROUTES.has(seg);
  if (area === "free-offer") return FREE_OFFER_ROUTES.has(seg);
  if (area === "onboarding" || area === "free-quiz") return seg === "onboarding";
  return seg === AREA_ROOT[area];
}

// Where a tapped notification opens. A club's session or game (the one
// notification about clubs) carries that club's page on the website; in
// the free app it opens the same club here. Everything else opens where
// the person lives: Home for a member, Friends for a free account.
const CLUB_PAGE = /^\/log\/club\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function pushRoute(area: Area | null, url: unknown): string {
  if (!area) return "/";
  const club = area === "free" && typeof url === "string" ? CLUB_PAGE.exec(url)?.[1] : null;
  return club ? `/club/${club}` : areaHome(area);
}
