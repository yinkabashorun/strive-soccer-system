import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  APP_BUILD,
  APP_UNAVAILABLE_PATH,
  SCREENS,
  appBuildOf,
  appScreenRedirect,
  screenFor,
} from "@/lib/elite/app-review";

// Guideline 2.5.19 (punch list A25): inside the App Store app a screen is
// drawn only when a reviewed build describes it. ONE list
// (lib/elite/app-review.ts); this test makes sure nothing is left off it.

const root = join(__dirname, "..");
const APP = "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 StriveEliteApp/1";
const SAFARI = "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// app/(player)/courses/[slug]/page.tsx -> /courses/[slug]
function routeOf(file: string): string {
  const parts = relative(join(root, "app"), file).split(sep).slice(0, -1);
  const kept = parts.filter((p) => !/^\(.*\)$/.test(p));
  return "/" + kept.join("/");
}

const routes = walk(join(root, "app"))
  .filter((f) => /[/\\](page|route)\.tsx?$/.test(f))
  .filter((f) => !relative(join(root, "app"), f).startsWith("api" + sep))
  .map(routeOf);

describe("every screen is on the review list", () => {
  it("finds the pages", () => {
    expect(routes.length).toBeGreaterThan(40);
    expect(routes).toContain("/dashboard");
    expect(routes).toContain("/courses/[slug]");
  });

  it("lists every page and route outside the API, exactly once", () => {
    const listed = SCREENS.map((s) => s.path);
    expect(new Set(listed).size, "a screen is listed twice").toBe(listed.length);
    for (const r of routes) {
      expect(listed, `${r} is not in lib/elite/app-review.ts: add it with since: null`).toContain(r);
    }
  });

  it("lists nothing that no longer exists", () => {
    for (const s of SCREENS) expect(routes, `${s.path} has no page`).toContain(s.path);
  });

  it("never lists a build newer than the one the app sends", () => {
    for (const s of SCREENS) if (s.since !== null) expect(s.since).toBeLessThanOrEqual(APP_BUILD);
  });
});

describe("what the app draws", () => {
  it("leaves the website alone", () => {
    for (const r of ["/log", "/demo", "/somewhere-new", "/dashboard"]) {
      expect(appScreenRedirect(r, SAFARI)).toBeNull();
      expect(appScreenRedirect(r, null)).toBeNull();
    }
  });

  it("draws the member side, the coach side and the pages every app needs", () => {
    for (const r of ["/", "/dashboard", "/courses/keep-it-up", "/coach/players/abc", "/account/delete", "/privacy", "/support", "/auth/confirm"]) {
      expect(appScreenRedirect(r, APP), r).toBeNull();
    }
  });

  it("draws the free app in the first build (Coach Yinka, Nov 20: App Store asap)", () => {
    for (const r of ["/join", "/log", "/log/u/123", "/log/club/abc", "/log/clubs", "/log/settings", "/coach/free"]) {
      expect(appScreenRedirect(r, APP), r).toBeNull();
    }
  });

  it("keeps website-only and unlisted screens out of the app", () => {
    for (const r of ["/demo", "/5v5", "/signup", "/leads", "/preview/abc", "/brand-new-feature"]) {
      expect(appScreenRedirect(r, APP), r).toBe(APP_UNAVAILABLE_PATH);
    }
  });

  it("never sends the landing page somewhere else", () => {
    expect(appScreenRedirect(APP_UNAVAILABLE_PATH, APP)).toBeNull();
  });

  it("reads the build from the user agent", () => {
    expect(appBuildOf(SAFARI)).toBeNull();
    expect(appBuildOf(APP)).toBe(1);
    expect(appBuildOf("x StriveEliteApp/7 y")).toBe(7);
    expect(appBuildOf("x StriveEliteApp/")).toBe(1);
  });

  it("matches a route with its parameter, and only that route", () => {
    expect(screenFor("/courses/strength")?.path).toBe("/courses/[slug]");
    expect(screenFor("/courses/strength/extra")).toBeNull();
    expect(screenFor("/dashboard/")?.path).toBe("/dashboard");
  });
});

describe("the gate is wired in", () => {
  const middleware = readFileSync(join(root, "middleware.ts"), "utf8");

  it("runs in the middleware before anything else, on every page", () => {
    expect(middleware).toContain("appScreenRedirect(path");
    expect(middleware.indexOf("appScreenRedirect(path")).toBeLessThan(middleware.indexOf("updateSession(request)"));
    expect(middleware).toContain('matcher: ["/((?!api/|_next/|.*\\\\.[a-zA-Z0-9]+$).*)"]');
  });

  it("sends the same build number the list is written against", () => {
    const config = readFileSync(join(root, "native", "capacitor.config.ts"), "utf8");
    expect(config).toContain(`appendUserAgent: "StriveEliteApp/${APP_BUILD}"`);
  });

  it("the landing page links nowhere outside the app", () => {
    const page = readFileSync(join(root, "app", "app-unavailable", "page.tsx"), "utf8");
    expect(page).not.toMatch(/https?:\/\//);
    expect(page).not.toContain('target="_blank"');
    expect(page).toContain("Delete my account");
  });
});
