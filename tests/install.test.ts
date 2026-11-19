import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import manifest from "@/app/manifest";
import { isIos, notifyStep, pushStatusLine, type InstallEnv } from "@/lib/elite/install";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

const env = (over: Partial<InstallEnv>): InstallEnv => ({
  userAgent: ANDROID,
  maxTouchPoints: 5,
  standalone: false,
  hasPush: true,
  permission: "default",
  ...over,
});

const root = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

// Width and height from a PNG's IHDR chunk.
function pngSize(rel: string): [number, number] {
  const b = readFileSync(path.join(root, rel));
  expect(b.subarray(1, 4).toString("ascii")).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe("which notifications card a member sees", () => {
  it("a browser that offers push asks once to turn it on", () => {
    expect(notifyStep(env({}))).toBe("enable");
  });

  it("an iPhone in a browser tab is shown how to add the app to the home screen", () => {
    // The case that showed nothing until Nov 18 2026.
    expect(
      notifyStep(env({ userAgent: IPHONE, hasPush: false, permission: "unsupported" }))
    ).toBe("install_ios");
  });

  it("an iPad that reports itself as a Mac gets the same card", () => {
    expect(isIos(IPAD_AS_MAC, 5)).toBe(true);
    expect(
      notifyStep(env({ userAgent: IPAD_AS_MAC, hasPush: false, permission: "unsupported" }))
    ).toBe("install_ios");
  });

  it("a real Mac without push is shown nothing", () => {
    expect(isIos(IPAD_AS_MAC, 0)).toBe(false);
    expect(
      notifyStep(
        env({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0, hasPush: false, permission: "unsupported" })
      )
    ).toBe("none");
  });

  it("the installed iPhone app asks to turn notifications on", () => {
    expect(notifyStep(env({ userAgent: IPHONE, standalone: true }))).toBe("enable");
  });

  it("an installed iPhone app on an iOS without push is shown nothing", () => {
    expect(
      notifyStep(
        env({ userAgent: IPHONE, standalone: true, hasPush: false, permission: "unsupported" })
      )
    ).toBe("none");
  });

  it("a member who already said yes is re-saved quietly, never asked again", () => {
    expect(notifyStep(env({ permission: "granted" }))).toBe("resync");
  });

  it("a member who blocked notifications is not nagged", () => {
    expect(notifyStep(env({ permission: "denied" }))).toBe("none");
  });
});

describe("the coach's push status line", () => {
  it("names the two missing keys when push is not set up", () => {
    const s = pushStatusLine({ configured: false, devices: 0, playersOn: 0, playersTotal: 6 });
    expect(s.ok).toBe(false);
    expect(s.line).toContain("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
    expect(s.line).toContain("VAPID_PRIVATE_KEY");
  });

  it("warns when the keys are set but nobody has turned it on", () => {
    const s = pushStatusLine({ configured: true, devices: 0, playersOn: 0, playersTotal: 6 });
    expect(s.ok).toBe(false);
    expect(s.line).toContain("none of your 6 active players");
  });

  it("counts players and devices once someone has", () => {
    const s = pushStatusLine({ configured: true, devices: 3, playersOn: 2, playersTotal: 6 });
    expect(s).toEqual({ ok: true, line: "On for 2 of 6 active players (3 devices)." });
  });
});

describe("the app installs to the home screen", () => {
  const m = manifest();

  it("opens as its own app at the front door, never the landing page", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.name).toBe("Strive Elite");
    expect(m.background_color).toBe("#000000");
  });

  it("every icon it names exists at the size it claims", () => {
    const icons = m.icons ?? [];
    expect(icons.length).toBeGreaterThanOrEqual(4);
    for (const icon of icons) {
      const [w, h] = pngSize(path.join("public", icon.src));
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
    const has = (size: string, purpose: string) =>
      icons.some((i) => i.sizes === size && i.purpose === purpose);
    expect(has("192x192", "any")).toBe(true);
    expect(has("512x512", "any")).toBe(true);
    expect(has("512x512", "maskable")).toBe(true);
  });

  it("the iPhone is told it is an app", () => {
    expect(read("app/layout.tsx")).toMatch(/appleWebApp:\s*{[^}]*capable:\s*true/);
  });

  it("the service worker and its notification icon exist", () => {
    const sw = read("public/sw.js");
    expect(sw).toContain('addEventListener("push"');
    const icon = sw.match(/icon:\s*"([^"]+)"/)?.[1];
    expect(icon).toBeTruthy();
    pngSize(path.join("public", icon!));
  });

  it("the notifications card decides through notifyStep and handles the iPhone case", () => {
    const card = read("components/elite/PushOptIn.tsx");
    expect(card).toContain("readStep()");
    expect(read("lib/elite/push-client.ts")).toContain("notifyStep(");
    expect(card).toContain('"install_ios"');
    expect(card).toContain("Add to Home Screen");
  });

  it("member-facing wording follows the house rules", () => {
    const card = read("components/elite/PushOptIn.tsx");
    const copy = card.replace(/\/\/.*$/gm, "");
    expect(copy).not.toMatch(/—|\bAI\b|automated|algorithm/);
  });
});
