import type { AppBootstrap, AppMemberState } from "@shared/app-contract";

// Where the app belongs for who is signed in, the same order as the
// website's member shell (app/(player)/layout.tsx, lib/elite/member-gate.ts),
// as screen groups:
//   sign-in     nobody is signed in
//   agreement   "Before you train", once
//   onboarding  the door, the quiz (ending on the photo and @username), building
//   gate        a screen that says what is happening and what is next
//   profile     a member from before 081 owes a photo or a username: asked
//               once, after the gate and before the app, like the website
//   app         the tabs and everything one tap from them
// Pure, tested in tests/logic.test.ts.
export type Area = "sign-in" | "agreement" | "onboarding" | "gate" | "profile" | "app";

export function areaFor(
  signedIn: boolean,
  state: AppMemberState | null | undefined,
  setup?: AppBootstrap["profileSetup"]
): Area | null {
  if (!signedIn) return "sign-in";
  if (!state) return null; // still reading who this is: stay where we are
  switch (state.kind) {
    case "ok":
      return setup && setup.steps.length > 0 ? "profile" : "app";
    case "consent":
      return "agreement";
    case "onboarding":
      return "onboarding";
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
};

// Routes outside the tabs that still belong to the app area (the profile
// screens too: changing the photo or the username from Settings).
const APP_ROUTES = new Set(["(tabs)", "session", "drop", "extra", "checkin", "settings", "change-password", "delete-account", "profile-setup"]);
// Account pages any signed-in person can reach from a gate or the agreement
// (App Review 5.1.1(v): deleting the account is never behind the gate).
const ALWAYS = new Set(["settings", "change-password", "delete-account"]);

export function inArea(area: Area, segments: readonly string[]): boolean {
  const seg = segments[0] ?? "";
  if (area !== "sign-in" && ALWAYS.has(seg)) return true;
  // The building screen finishes what the quiz started, whatever the gate
  // says once the quiz is saved (a Pro member is in at once; an Elite
  // family waits for the coach, and the screen says so).
  if (area !== "sign-in" && seg === "onboarding" && segments[1] === "building") return true;
  if (area === "app") return APP_ROUTES.has(seg) || seg === "";
  if (area === "onboarding") return seg === "onboarding";
  return seg === AREA_ROOT[area];
}
