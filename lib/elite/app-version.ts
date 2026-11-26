// WHICH BUILD OF THE IPHONE APP STILL WORKS, AND WHERE TO GET THE APP
// (Nov 26 2026, before the app goes out on a public TestFlight link).
//
// Two things a finished app has and this one did not:
//
//   1. THE OLDEST BUILD THAT STILL WORKS. The app shows only what the
//      server behind it sends, and the server moves every day. Once
//      hundreds of players are on different builds, a build that is too
//      old to work must say so, with one button to the new one, instead of
//      showing buttons that answer nothing. The coaches set one number
//      (/coach/free); a build under it shows the update screen and nothing
//      else. 0 means every build works, which is where it starts.
//   2. ONE LINK TO THE APP. The TestFlight public link today, the App
//      Store page later. The update screen's button opens it, and
//      /join shows it to a teammate who taps an invite on an iPhone, so
//      they land in the app (where training is timed) and not in a
//      website sign-up.
//
// The rule fails OPEN: a build that cannot be read, a setting that cannot
// be read, no connection: the app opens as it always did. A check that
// can lock a player out by mistake is worse than no check.
//
// Pure, and shared with the phone ("@shared/app-version").

export type AppVersion = { minBuild: number; link: string | null };

export const NO_APP_VERSION: AppVersion = { minBuild: 0, link: null };

// Only Apple's own two hosts can be the link: the button opens it straight
// from the app and from /join, so it must never be made to point elsewhere.
export const APP_LINK_HOSTS = ["apps.apple.com", "testflight.apple.com"] as const;

export function cleanAppLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > 300) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (!(APP_LINK_HOSTS as readonly string[]).includes(url.hostname)) return null;
  return url.toString();
}

export const MAX_BUILD = 100000;

// A build number as the coaches type it, or as the app reports its own.
export function cleanBuild(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d{1,6}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > MAX_BUILD) return null;
  return n;
}

export function cleanAppVersion(raw: { minBuild?: unknown; link?: unknown } | null | undefined): AppVersion {
  return { minBuild: cleanBuild(raw?.minBuild) ?? 0, link: cleanAppLink(raw?.link) };
}

// Must this build stop and ask for the new one? Only when both numbers
// are known and this build is under the oldest that still works.
export function mustUpdate(build: unknown, version: AppVersion | null | undefined): boolean {
  const mine = cleanBuild(build);
  if (mine === null || !version) return false;
  return version.minBuild > 0 && mine < version.minBuild;
}

// The update screen's words (mobile/src/UpdateGate.tsx).
export const UPDATE_TITLE = "A new Strive Elite is ready";
export const UPDATE_BODY = "This version of the app is too old to work. Get the new one. Your training, your friends and your clubs are all still there.";
export const UPDATE_BUTTON = "Get the new version";
export const UPDATE_NO_LINK = "Open TestFlight or the App Store on this phone and update Strive Elite.";

// /join, for a teammate who taps an invite on an iPhone
// (components/elite/GetTheApp.tsx).
export const GET_APP_TITLE = "Strive Elite is an iPhone app";
export const GET_APP_BODY = "Get the app, tap Join free, and type this code when it asks. You go straight to your friends.";
export const GET_APP_BODY_NO_CODE = "Get the app and tap Join free. Your training is timed in the app, and only timed training counts on the board.";
export const GET_APP_BUTTON = "Get the app";
export const GET_APP_CODE_LABEL = "Your code";
export const GET_APP_WEB = "No iPhone? Join on the web";
