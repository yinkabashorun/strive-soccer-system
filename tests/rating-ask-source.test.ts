// The App Store rating ask in the iPhone app (mobile/src/rating-ask.ts is
// the rule, tested in mobile/tests): only Apple's own sheet, asked from one
// file, only from the good moments, guarded by the example-build flag.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const mobile = path.resolve(__dirname, "../mobile");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("the App Store rating ask, in the app's source", () => {
  const all = [...files(path.join(mobile, "app")), ...files(path.join(mobile, "src"))];

  it("only Apple's sheet, after isAvailableAsync, recorded either way, never in the example build", () => {
    const src = readFileSync(path.join(mobile, "src/rating.ts"), "utf8");
    expect(src).toContain("StoreReview.isAvailableAsync()");
    expect(src).toContain("StoreReview.requestReview()");
    expect(src).toContain("fixtures: FIXTURES");
    expect(src.indexOf('setPref("ratingAsked"')).toBeLessThan(src.indexOf("StoreReview.requestReview()"));
  });

  it("asked from one file, called only from the good moments, with no screen of ours", () => {
    const using = all.filter((f) => readFileSync(f, "utf8").includes("expo-store-review")).map((f) => path.relative(mobile, f));
    expect(using).toEqual(["src/rating.ts"]);
    const callers = all
      .filter((f) => /askForRating\(/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(mobile, f))
      .sort();
    expect(callers).toEqual(["app/(free)/my-week.tsx", "app/session/[n].tsx", "src/rating.ts"]);
    for (const f of all) expect(readFileSync(f, "utf8"), f).not.toMatch(/rate (the|this) app|enjoying strive|like the app\?/i);
    // the session screen tells the rule it is open
    expect(readFileSync(path.join(mobile, "app/session/[n].tsx"), "utf8")).toContain("setSessionOpen(true)");
  });
});
