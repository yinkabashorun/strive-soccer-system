// WHEN THE APP ASKS FOR AN APP STORE RATING. Pure, so it is tested
// (tests/rating-ask.test.ts); src/rating.ts does the asking.
//
// The ask is Apple's own sheet and nothing else: no "do you like the app"
// screen of ours, no button anywhere. Apple decides whether the sheet
// really shows (it limits it itself, and never shows it in TestFlight); we
// only decide when we are allowed to ask:
//   - right after one of the good moments below, and only then;
//   - at most once per app version on this phone;
//   - never before the account has been on this phone for 7 days (the
//     first time the app opened here is kept on the phone);
//   - never while a session is open or a training clock is running;
//   - never in the example build.
export type RatingMoment =
  // the free app: the week reached its target, seen on the Week tab
  | "week_target"
  // a member: the last session of the week finished and its finish screen closed
  | "member_week_done"
  // the Monday card said "Your best week yet." and was put away
  | "best_week";

export const RATING_MOMENTS: readonly RatingMoment[] = ["week_target", "member_week_done", "best_week"];
export const RATING_MIN_DAYS = 7;
const DAY_MS = 86_400_000;

export type RatingFacts = {
  moment: RatingMoment | null;
  version: string | null; // this build's version, e.g. "1.0.0 (10)"
  askedVersion: string; // the version it was last asked in, "" for never
  firstOpen: string; // ISO time the app first opened on this phone, "" for unknown
  nowMs: number;
  inSession: boolean;
  clockRunning: boolean;
  fixtures: boolean;
};

export function ratingDue(f: RatingFacts): boolean {
  if (f.fixtures || !f.moment || !RATING_MOMENTS.includes(f.moment)) return false;
  if (!f.version || f.askedVersion === f.version) return false;
  if (f.inSession || f.clockRunning) return false;
  const first = Date.parse(f.firstOpen);
  if (!Number.isFinite(first)) return false;
  return f.nowMs - first >= RATING_MIN_DAYS * DAY_MS;
}

// The version an ask is remembered by: the version and the build number,
// so a TestFlight build (where Apple never shows the sheet) does not use up
// the App Store build's one ask.
export function ratingVersion(version: string | null | undefined, build: string | null | undefined): string | null {
  if (!version) return null;
  return build ? `${version} (${build})` : version;
}

// Did the free week just reach its target?
export function weekAtTarget(minutes: number, target: number): boolean {
  return target > 0 && minutes >= target;
}
