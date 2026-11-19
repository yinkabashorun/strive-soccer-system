import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// The old $97 dribbling course sales page was retired Nov 18 2026 (Coach
// Yinka's call). A public price page for digital content on the app's own
// domain is also what an App Store reviewer points at, so it must not come
// back by accident.
describe("the old $97 sales page stays retired", () => {
  it("has no page, no checkout and no buyer route", () => {
    for (const p of [
      "app/(public)/dribbling-course",
      "app/api/checkout/dribbling-course",
      "app/api/ghl/dribbling-course-buyer",
      "components/DribblingCheckoutButton.tsx",
      "components/PostPurchaseTagger.tsx",
    ]) {
      expect(existsSync(join(root, p)), p).toBe(false);
    }
  });

  it("old links land on the Strive Elite page", () => {
    const config = read("next.config.js");
    expect(config).toContain('source: "/dribbling-course", destination: "/demo"');
    expect(config).toContain('source: "/dribbling-course/:path*", destination: "/demo"');
  });

  it("no public page inherits a price in its title or link preview", () => {
    const layout = read("app/(public)/layout.tsx");
    expect(layout).not.toMatch(/\$\d/);
    expect(layout).not.toContain("Dribbling System");
    expect(layout).toContain('title: "Strive Elite"');
  });

  it("nothing in the app links to it any more", () => {
    expect(read("components/Sidebar.tsx")).not.toContain("/dribbling-course");
    expect(read("app/(app)/admin/course-ads/page.tsx")).not.toContain("/dribbling-course");
  });
});
