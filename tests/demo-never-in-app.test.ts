import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  APP_FRONT_DOOR,
  NATIVE_UA_TOKEN,
  demoRedirectFor,
  pixelAllowed,
} from "../lib/elite/app-links";
import { memberFiles, rel } from "./helpers/member-files";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// The public /demo page carries the Meta pixel. The App Store listing
// says the app does no tracking, so that page can never be drawn inside
// the app (App Store punch list A27). Three guards, each held here.

const APP = `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ${NATIVE_UA_TOKEN}1`;
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

describe("the rule", () => {
  it("the app is sent to its front door, everyone else sees the page", () => {
    expect(APP_FRONT_DOOR).toBe("/");
    expect(demoRedirectFor(APP)).toBe("/");
    expect(demoRedirectFor(SAFARI)).toBeNull();
    expect(demoRedirectFor(null)).toBeNull();
    expect(demoRedirectFor("")).toBeNull();
  });

  it("the pixel is allowed everywhere except the app", () => {
    expect(pixelAllowed(SAFARI)).toBe(true);
    expect(pixelAllowed(null)).toBe(true);
    expect(pixelAllowed(APP)).toBe(false);
  });
});

describe("guard one: the page", () => {
  const page = read("app/(public)/demo/page.tsx");

  it("reads who is asking on every request and redirects the app before anything is drawn", () => {
    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).toContain('headers().get("user-agent")');
    expect(page).toContain("demoRedirectFor(userAgent)");
    expect(page).toContain("if (door) redirect(door);");
    expect(page.indexOf("redirect(door)")).toBeLessThan(page.indexOf("<DemoLanding"));
  });

  it("the front door is the app's own, never the landing page", () => {
    const door = read("app/page.tsx");
    expect(door).not.toContain("DemoLanding");
    expect(door).not.toContain("MetaPixel");
  });
});

describe("guard two: old links that point at the page", () => {
  const config = read("next.config.js");

  it("from the app they go to the front door, and that rule comes first", () => {
    expect(config).toContain(`value: ".*${NATIVE_UA_TOKEN}.*"`);
    const native = 'source: "/dribbling-course", has: [NATIVE_APP_HEADER], destination: "/"';
    const web = 'source: "/dribbling-course", destination: "/demo"';
    expect(config).toContain(native);
    expect(config).toContain('source: "/dribbling-course/:path*", has: [NATIVE_APP_HEADER], destination: "/"');
    expect(config).toContain(web);
    expect(config.indexOf(native)).toBeLessThan(config.indexOf(web));
  });

  it("the pattern matches the app's user agent and not a browser's", () => {
    // Next matches a header rule against the whole value.
    const pattern = new RegExp(`^.*${NATIVE_UA_TOKEN}.*$`);
    expect(pattern.test(APP)).toBe(true);
    expect(pattern.test(SAFARI)).toBe(false);
  });
});

describe("guard three: the pixel itself", () => {
  const pixel = read("components/elite/MetaPixel.tsx");
  const landing = read("components/elite/DemoLanding.tsx");

  it("the landing page leaves the pixel out for the app's user agent", () => {
    expect(landing).toContain("{pixelAllowed(userAgent) && <MetaPixel id={META_PIXEL_ID} />}");
  });

  it("the component decides again in the browser, before any script is added", () => {
    expect(pixel).toContain("pixelAllowed(navigator.userAgent) && !isNativeApp()");
    // nothing loads until the answer is known, and nothing at all on a no
    expect(pixel).toContain("useState<boolean | null>(null)");
    expect(pixel).toContain("if (!id || allowed === false) return null;");
    expect(pixel).toMatch(/\{allowed && \(\s*<Script id="meta-pixel"/);
    expect(pixel).toContain("if (!id || !allowed) return;");
  });

  it("the pixel is on the landing page only, never on a member screen", () => {
    const using = memberFiles()
      .filter((f) => /MetaPixel|fbevents|fbq\(/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(using).toEqual([]);
  });

  it("the free log's one line about the coached program is never drawn inside the app", () => {
    // A free account is not a member: on the website its week ends with one
    // plain line that leads to the public page. The address lives in the
    // rule (lib/elite/tracker.ts programLink), which answers null inside
    // the app, and the screen draws nothing without an address.
    const rules = readFileSync(join(__dirname, "..", "lib/elite/tracker.ts"), "utf8");
    expect(rules).toMatch(/export function programLink\(inApp: boolean\): string \| null \{\s*return inApp \? null : PROGRAM_PAGE;/);
    const page = readFileSync(join(__dirname, "..", "app/(free)/log/week/page.tsx"), "utf8");
    expect(page).toContain("programHref={programLink(inNativeApp())}");
    const home = readFileSync(join(__dirname, "..", "components/elite/MyWeek.tsx"), "utf8");
    expect(home).toMatch(/\{programHref && \(/);
    expect(home).toContain("<Link href={programHref}");
  });

  it("nothing a member can reach links to /demo", () => {
    const linking = memberFiles()
      .filter((f) => /["'`]\/demo["'`/?#]/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(linking).toEqual([]);
  });
});
