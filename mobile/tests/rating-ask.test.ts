// When the app asks for an App Store rating (src/rating-ask.ts, asked by
// src/rating.ts): Apple's own sheet, at a good moment, once per version.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RATING_MIN_DAYS, ratingDue, ratingVersion, weekAtTarget, type RatingFacts } from "@/rating-ask";

const DAY = 86_400_000;
const now = Date.parse("2026-12-10T20:00:00Z");
const ok: RatingFacts = {
  moment: "week_target",
  version: "1.0.0 (12)",
  askedVersion: "",
  firstOpen: new Date(now - 10 * DAY).toISOString(),
  nowMs: now,
  inSession: false,
  clockRunning: false,
  fixtures: false,
};

const mobile = path.resolve(__dirname, "..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("the App Store rating ask", () => {
  it("asks at a good moment once the account is a week old here", () => {
    expect(ratingDue(ok)).toBe(true);
    expect(ratingDue({ ...ok, moment: "member_week_done" })).toBe(true);
    expect(ratingDue({ ...ok, moment: "best_week" })).toBe(true);
  });

  it("never without a moment", () => {
    expect(ratingDue({ ...ok, moment: null })).toBe(false);
  });

  it("once per app version", () => {
    expect(ratingDue({ ...ok, askedVersion: "1.0.0 (12)" })).toBe(false);
    expect(ratingDue({ ...ok, askedVersion: "1.0.0 (11)" })).toBe(true);
    expect(ratingDue({ ...ok, version: null })).toBe(false);
    expect(ratingVersion("1.0.0", "12")).toBe("1.0.0 (12)");
    expect(ratingVersion("1.0.0", null)).toBe("1.0.0");
    expect(ratingVersion(undefined, "12")).toBeNull();
  });

  it("never before 7 days on this phone, or when the first open is unknown", () => {
    expect(RATING_MIN_DAYS).toBe(7);
    expect(ratingDue({ ...ok, firstOpen: new Date(now - 6.9 * DAY).toISOString() })).toBe(false);
    expect(ratingDue({ ...ok, firstOpen: new Date(now - 7 * DAY).toISOString() })).toBe(true);
    expect(ratingDue({ ...ok, firstOpen: "" })).toBe(false);
  });

  it("never in a session, with a clock running, or in the example build", () => {
    expect(ratingDue({ ...ok, inSession: true })).toBe(false);
    expect(ratingDue({ ...ok, clockRunning: true })).toBe(false);
    expect(ratingDue({ ...ok, fixtures: true })).toBe(false);
  });

  it("the week's target", () => {
    expect(weekAtTarget(240, 240)).toBe(true);
    expect(weekAtTarget(239, 240)).toBe(false);
    expect(weekAtTarget(10, 0)).toBe(false);
  });

  it("only Apple's own sheet, asked from one file, after isAvailableAsync, recorded either way", () => {
    const src = readFileSync(path.join(mobile, "src/rating.ts"), "utf8");
    expect(src).toContain("StoreReview.isAvailableAsync()");
    expect(src).toContain("StoreReview.requestReview()");
    expect(src).toContain("fixtures: FIXTURES");
    // recorded before Apple's sheet, so it counts whether or not it showed
    expect(src.indexOf('setPref("ratingAsked"')).toBeLessThan(src.indexOf("StoreReview.requestReview()"));
    const all = [...files(path.join(mobile, "app")), ...files(path.join(mobile, "src"))];
    const using = all.filter((f) => readFileSync(f, "utf8").includes("expo-store-review")).map((f) => path.relative(mobile, f));
    expect(using).toEqual(["src/rating.ts"]);
    // no screen of ours asks it, no button: only the moments call it
    const callers = all.filter((f) => /askForRating\(/.test(readFileSync(f, "utf8"))).map((f) => path.relative(mobile, f)).sort();
    expect(callers).toEqual(["app/(free)/my-week.tsx", "app/session/[n].tsx", "src/rating.ts"]);
    for (const f of all) expect(readFileSync(f, "utf8"), f).not.toMatch(/rate (the|this) app|enjoying strive|like the app\?/i);
  });
});
