import type { AppMemberState } from "@shared/app-contract";

// Where the app belongs for who is signed in, the same member gate as the
// website (lib/elite/member-gate.ts), as screen groups:
//   sign-in     nobody is signed in
//   agreement   "Before you train", once
//   onboarding  the door, the quiz, building
//   gate        a screen that says what is happening and what is next
//   app         the tabs and everything one tap from them
// Pure, tested in tests/navigation.test.ts.
export type Area = "sign-in" | "agreement" | "onboarding" | "gate" | "app";

export function areaFor(signedIn: boolean, state: AppMemberState | null | undefined): Area | null {
  if (!signedIn) return "sign-in";
  if (!state) return null; // still reading who this is: stay where we are
  switch (state.kind) {
    case "ok":
      return "app";
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
  app: "(tabs)",
};

// Routes outside the tabs that still belong to the app area.
const APP_ROUTES = new Set(["(tabs)", "session", "drop", "extra", "checkin", "settings", "change-password", "delete-account"]);
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
  // The building screen and the drop come right after the quiz.
  if (area === "onboarding") return seg === "onboarding";
  return seg === AREA_ROOT[area];
}
