// The For parents page (/parents): public, plain, true of the app as
// built, the price from the one constant, and allowed inside the app.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCREENS } from "@/lib/elite/app-review";

const root = path.resolve(__dirname, "..");
const file = path.join(root, "app/parents/page.tsx");

describe("the For parents page", () => {
  it("exists, outside every signed-in group, and asks nobody to sign in", () => {
    expect(existsSync(file)).toBe(true);
    const src = readFileSync(file, "utf8");
    expect(src).not.toMatch(/getViewer|redirect\(|requireViewer/);
    expect(src).toContain("For parents");
  });

  it("says your player, never your child or your kid", () => {
    const src = readFileSync(file, "utf8");
    expect(src).toContain("your player");
    expect(src.toLowerCase()).not.toMatch(/your (child|kid)/);
  });

  it("no em dash, no AI words, no safety guarantee", () => {
    const src = readFileSync(file, "utf8");
    expect(src).not.toMatch(/[\u2014\u2013]/);
    expect(src).not.toMatch(/\bAI\b|automated|algorithm/);
    expect(src.toLowerCase()).not.toMatch(/\bsafe\b(?!-area)|guarantee/);
  });

  it("never names a price by hand", () => {
    const src = readFileSync(file, "utf8");
    expect(src).toContain("PRO_PRICE_LINE");
    expect(src).not.toMatch(/\$\s?\d/);
  });

  it("quotes the Terms' own report promise", () => {
    const src = readFileSync(file, "utf8");
    const terms = readFileSync(path.join(root, "app/terms/page.tsx"), "utf8").replace(/\s+/g, " ");
    const quote = "we look at every report within 24 hours, remove what breaks these terms, and close the account that posted it.";
    expect(terms).toContain(quote);
    expect(src.replace(/\s+/g, " ")).toContain(quote);
  });

  it("is on the app-review list, and linked from Support and the free sign-up", () => {
    expect(SCREENS.some((s) => s.path === "/parents" && s.since !== null)).toBe(true);
    expect(readFileSync(path.join(root, "app/support/page.tsx"), "utf8")).toContain('href="/parents"');
    expect(readFileSync(path.join(root, "components/elite/JoinForm.tsx"), "utf8")).toContain('href="/parents"');
  });
});
