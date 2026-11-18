import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const middleware = readFileSync(join(root, "middleware.ts"), "utf8");

// Staying signed in (App Store punch list A19). The session token is
// refreshed on the server; the refreshed cookie can only be written back
// when the middleware ran for that page. A member area missing from the
// matcher loses its refresh, and inside the iPhone app that ends in a
// surprise sign-out.

const matched = (path: string) =>
  middleware.includes(`"${path}/:path*"`) || middleware.includes(`"${path}"`);

describe("the session is refreshed on every signed-in area", () => {
  it("covers every member page", () => {
    const dir = join(root, "app", "(player)");
    const areas = readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory());
    expect(areas.length).toBeGreaterThanOrEqual(6);
    for (const area of areas) expect(matched(`/${area}`), `/${area} is not in middleware.ts`).toBe(true);
  });

  it("covers the coach side, the account pages, onboarding and the front door", () => {
    for (const path of ["/coach", "/account", "/onboarding"]) expect(matched(path), path).toBe(true);
    expect(middleware).toMatch(/matcher:\s*\[[\s\S]*"\/",/);
  });

  it("still leaves the public pages and the API alone", () => {
    for (const path of ["/demo", "/privacy", "/terms", "/support", "/api"]) expect(matched(path), path).toBe(false);
  });
});
