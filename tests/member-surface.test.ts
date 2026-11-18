import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { memberFiles, rel } from "./helpers/member-files";

// The floors every member-facing screen holds (App Store punch list, A2
// and A15): no type under 11 px (Apple's minimum), and no grey text on
// black below the contrast a tired eye can read.

const files = memberFiles();

describe("member-facing screens: the floors", () => {
  it("finds the member surface", () => {
    expect(files.length).toBeGreaterThan(40);
    const names = files.map(rel);
    expect(names).toContain("app/(player)/dashboard/page.tsx");
    expect(names).toContain("components/elite/SessionPlayer.tsx");
    expect(names).toContain("components/elite/LoginForm.tsx");
    expect(names).toContain("components/elite/OnboardingForm.tsx");
    // the free training log (069) holds the same floors
    expect(names).toContain("app/(free)/log/page.tsx");
    expect(names).toContain("components/elite/TrackerHome.tsx");
    expect(names).toContain("components/elite/TrackerQuiz.tsx");
    expect(names).toContain("components/elite/JoinForm.tsx");
  });

  it("no type under 11 px", () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (parseFloat(m[1]) < 11) bad.push(`${rel(f)}: ${m[0]}`);
      }
      for (const m of src.matchAll(/fontSize:\s*["']?(\d+(?:\.\d+)?)(?:px)?["']?/g)) {
        if (parseFloat(m[1]) < 11) bad.push(`${rel(f)}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("no grey text on black below 4.5 to 1 (white under 50% is too dim)", () => {
    // White at 50% on black is 5.3 to 1; at 45% it is 4.4 to 1. A variant
    // prefix (placeholder:, disabled:) is not body text and is left alone.
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/(?<![:\w-])text-white\/(\d+)\b/g)) {
        if (Number(m[1]) < 50) bad.push(`${rel(f)}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
