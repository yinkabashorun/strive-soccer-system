// What the App Store app is allowed to show (punch list A25).
//
// The iPhone app draws its screens from this website. Apple's guideline
// 2.5.19 (Oct 16 2026) says a feature added to the site after a build was
// approved reaches the app without review, and that is grounds for removal.
// So every screen of the site is listed here ONCE, with the first app build
// whose review describes it. Inside the app a screen is drawn only when the
// build on the phone is that build or newer; anything else, including a
// screen nobody listed, goes to /app-unavailable. On the website nothing
// changes.
//
// HOW TO ADD A SCREEN: add it here with since: null. It is live on the
// website at once and hidden inside the app. When a build that describes it
// (in docs/app-store/listing.md) is approved, set since to that build's
// number and raise APP_BUILD in the same change (native/capacitor.config.ts
// sends it in the user agent, "StriveEliteApp/<build>"). A new card or
// button inside an existing screen is a new feature too: give it its own
// screen, or keep it off inside the app with inNativeApp() until reviewed.
//
// tests/app-review.test.ts fails the build when a page or route exists that
// is not on this list, so nothing can be forgotten.

import { NATIVE_UA_TOKEN } from "./app-links";

// The build the shell sends today. Raise it together with
// appendUserAgent in native/capacitor.config.ts.
export const APP_BUILD = 1;

export const APP_UNAVAILABLE_PATH = "/app-unavailable";

type Screen = {
  // The route as the app folder names it, groups left out:
  // "/coach/players/[id]".
  path: string;
  // The first app build whose review describes this screen, or null for a
  // screen that is on the website only.
  since: number | null;
};

const IN_FIRST_BUILD = 1;
const WEBSITE_ONLY = null;

export const SCREENS: readonly Screen[] = [
  // The front door, sign-in and the pages every app must have.
  { path: "/", since: IN_FIRST_BUILD },
  { path: "/login", since: IN_FIRST_BUILD },
  { path: "/forgot", since: IN_FIRST_BUILD },
  { path: "/reset", since: IN_FIRST_BUILD },
  { path: "/auth/callback", since: IN_FIRST_BUILD },
  { path: "/auth/confirm", since: IN_FIRST_BUILD },
  { path: "/privacy", since: IN_FIRST_BUILD },
  { path: "/terms", since: IN_FIRST_BUILD },
  { path: "/support", since: IN_FIRST_BUILD },
  { path: APP_UNAVAILABLE_PATH, since: IN_FIRST_BUILD },

  // The member side, as the review notes describe it.
  { path: "/dashboard", since: IN_FIRST_BUILD },
  { path: "/homework", since: IN_FIRST_BUILD },
  { path: "/progress", since: IN_FIRST_BUILD },
  // You (Nov 21 2026, the approved redesign): the member card, time
  // trained, the weekly chart and the medals; Progress and Account under it.
  { path: "/you", since: IN_FIRST_BUILD },
  // Edit profile (081, Nov 23 2026): the member's photo and @username,
  // both asked for at onboarding. In the first build, which is not
  // submitted yet; the review notes describe the photo and the username
  // (docs/app-store/listing.md).
  { path: "/you/profile", since: IN_FIRST_BUILD },
  { path: "/film", since: IN_FIRST_BUILD },
  { path: "/messages", since: IN_FIRST_BUILD },
  { path: "/courses", since: IN_FIRST_BUILD },
  { path: "/courses/[slug]", since: IN_FIRST_BUILD },
  { path: "/onboarding", since: IN_FIRST_BUILD },
  { path: "/account", since: IN_FIRST_BUILD },
  { path: "/account/delete", since: IN_FIRST_BUILD },
  { path: "/account/password", since: IN_FIRST_BUILD },

  // The coach side (the review notes give the reviewer a coach login).
  { path: "/coach", since: IN_FIRST_BUILD },
  { path: "/coach/players/[id]", since: IN_FIRST_BUILD },
  { path: "/coach/calls", since: IN_FIRST_BUILD },
  { path: "/coach/drills", since: IN_FIRST_BUILD },
  { path: "/coach/courses", since: IN_FIRST_BUILD },
  { path: "/coach/courses/[slug]", since: IN_FIRST_BUILD },

  // Accounts are made on the website, by invite, after a call with a coach.
  { path: "/signup", since: WEBSITE_ONLY },

  // Strive Pro (074, Nov 20 2026): the page, and its sign-up. In the
  // first build: the sign-in screen offers it inside the app too, and the
  // card checkout is Stripe's page, which the phone opens outside the app
  // (a link out to pay, allowed for US storefronts). The listing and the
  // review notes must describe it before that build is submitted.
  { path: "/pro", since: IN_FIRST_BUILD },
  { path: "/pro/join", since: IN_FIRST_BUILD },
  // Where a Strive Pro checkout opened from the native iPhone app comes
  // back to, in the sheet over the app (Nov 24 2026): one line saying what
  // happened and to close the sheet. Nothing is sold on it.
  { path: "/pro/done", since: IN_FIRST_BUILD },
  // Send to a parent (Nov 24 2026, lib/elite/parent-link.ts): the page a
  // parent opens in their own browser from the link their player texted
  // them, and pays from. It is never opened inside the iPhone app: the app
  // only shares the link through the phone's share sheet.
  { path: "/pro/for/[code]", since: WEBSITE_ONLY },

  // The free app (photo posts between players, clubs, rankings). In the
  // first build on Coach Yinka's word (Nov 20 2026, "App store asap"):
  // free sign-up works inside the app (nothing is bought), and the listing
  // and the review notes describe it with its report, block, word filter
  // and coach queue (guideline 1.2).
  { path: "/join", since: IN_FIRST_BUILD },
  { path: "/log", since: IN_FIRST_BUILD },
  { path: "/log/week", since: IN_FIRST_BUILD },
  { path: "/log/days", since: IN_FIRST_BUILD },
  { path: "/log/quiz", since: IN_FIRST_BUILD },
  { path: "/log/clubs", since: IN_FIRST_BUILD },
  { path: "/log/club/[id]", since: IN_FIRST_BUILD },
  // Clubs as teams (077, Nov 22 2026): clubs near you, planning a club
  // session or a game, one session or game, Strive events and a club's
  // entry. In the first build, which is not submitted yet; the listing's
  // review notes describe them (docs/app-store/listing.md).
  { path: "/log/club/[id]/near", since: IN_FIRST_BUILD },
  { path: "/log/club/[id]/plan", since: IN_FIRST_BUILD },
  { path: "/log/plan/[id]", since: IN_FIRST_BUILD },
  { path: "/log/events", since: IN_FIRST_BUILD },
  { path: "/log/events/[id]", since: IN_FIRST_BUILD },
  { path: "/log/u/[id]", since: IN_FIRST_BUILD },
  // My drills (078, Nov 22 2026): a player's own named drills and the
  // takes they film of them, private to the player. In the first build,
  // which is not submitted yet; the review notes describe them
  // (docs/app-store/listing.md).
  { path: "/log/drills", since: IN_FIRST_BUILD },
  { path: "/log/drills/[id]", since: IN_FIRST_BUILD },
  { path: "/log/settings", since: IN_FIRST_BUILD },
  { path: "/log/settings/profile", since: IN_FIRST_BUILD },
  { path: "/log/settings/blocked", since: IN_FIRST_BUILD },
  { path: "/coach/free", since: IN_FIRST_BUILD },

  // Public pages: an ad landing page with the Meta pixel, the event page,
  // a shared week preview.
  { path: "/demo", since: WEBSITE_ONLY },
  { path: "/5v5", since: WEBSITE_ONLY },
  { path: "/preview/[token]", since: WEBSITE_ONLY },

  // Strive OS, the internal business tool.
  { path: "/admin/course-ads", since: WEBSITE_ONLY },
  { path: "/clients", since: WEBSITE_ONLY },
  { path: "/content", since: WEBSITE_ONLY },
  { path: "/course", since: WEBSITE_ONLY },
  { path: "/integrations", since: WEBSITE_ONLY },
  { path: "/leads", since: WEBSITE_ONLY },
  { path: "/leads/[id]", since: WEBSITE_ONLY },
  { path: "/os", since: WEBSITE_ONLY },
  { path: "/players", since: WEBSITE_ONLY },
  { path: "/players/[id]", since: WEBSITE_ONLY },
  { path: "/portal", since: WEBSITE_ONLY },
  { path: "/sessions", since: WEBSITE_ONLY },
  { path: "/sessions/[id]", since: WEBSITE_ONLY },
  { path: "/settings", since: WEBSITE_ONLY },
];

function patternFor(path: string): RegExp {
  if (path === "/") return /^\/$/;
  const body = path
    .split("/")
    .map((part) => (/^\[[^\]]+\]$/.test(part) ? "[^/]+" : part.replace(/[.*+?^${}()|\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${body}/?$`);
}

const COMPILED = SCREENS.map((s) => ({ ...s, re: patternFor(s.path) }));

export function screenFor(pathname: string): Screen | null {
  const hit = COMPILED.find((s) => s.re.test(pathname));
  return hit ? { path: hit.path, since: hit.since } : null;
}

// The build number in the app's user agent, or null when the request is
// not from the app. An app that sends no number is treated as build 1.
export function appBuildOf(userAgent: string | null | undefined): number | null {
  if (typeof userAgent !== "string") return null;
  const at = userAgent.indexOf(NATIVE_UA_TOKEN);
  if (at < 0) return null;
  const n = parseInt(userAgent.slice(at + NATIVE_UA_TOKEN.length), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// Where this request should go instead, or null to draw the page.
export function appScreenRedirect(pathname: string, userAgent: string | null | undefined): string | null {
  const build = appBuildOf(userAgent);
  if (build === null) return null; // the website
  const screen = screenFor(pathname);
  if (screen && screen.since !== null && screen.since <= build) return null;
  return APP_UNAVAILABLE_PATH;
}
