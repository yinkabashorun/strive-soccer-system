import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Coach Yinka, Nov 17 2026: the /demo page is "just the video and the
// form, take off prices and all of that". This keeps it that way: a
// price, a guarantee or a feature list added back fails here.
describe("/demo stays the video and the form", () => {
  const src = readFileSync(path.resolve(__dirname, "../components/elite/DemoLanding.tsx"), "utf8");
  // what a visitor can see: the JSX, not the comments above it
  const page = src.slice(src.indexOf("export function DemoLanding"));

  it("has the video and the intake form", () => {
    expect(page).toContain("<VslFilePlayer");
    expect(page).toContain("widget/survey/W14MZotX2vYkpyDPKOY8");
  });
  it("shows no price, no guarantee and no refund line", () => {
    expect(page).not.toMatch(/\$\s?\d/);
    expect(page).not.toMatch(/\/mo\b|a month|guarantee|refund|locked for life/i);
  });
  it("has no sections beyond that (no headline, lists or drill tiles)", () => {
    expect(page).not.toMatch(/<h1|<h2|SectionTitle|DrillVideo|\.map\(/);
  });
  it("keeps the house wording in its one line", () => {
    expect(page).toContain("your player");
    expect(page).not.toMatch(/your (child|kid)|\bAI\b|automated|—/);
  });
});
