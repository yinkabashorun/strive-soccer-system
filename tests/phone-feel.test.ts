import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FRESH_AFTER_MS,
  holdRefresh,
  refreshHolds,
  shouldRefreshOnReturn,
} from "@/lib/elite/fresh";
import { PUSH_ASKED_KEY, finishAsk } from "@/lib/elite/install";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

// App Store punch list A4, A5 and A8: the app behaves like the phone it is
// on, shows what is true now when it is reopened, and asks for
// notifications once, at a moment that explains itself.

describe("fresh on reopen", () => {
  it("refreshes after a minute or more away, and not after a glance elsewhere", () => {
    expect(FRESH_AFTER_MS).toBe(60_000);
    expect(shouldRefreshOnReturn({ hiddenForMs: 60_000, holds: 0 })).toBe(true);
    expect(shouldRefreshOnReturn({ hiddenForMs: 3_600_000, holds: 0 })).toBe(true);
    expect(shouldRefreshOnReturn({ hiddenForMs: 59_999, holds: 0 })).toBe(false);
    expect(shouldRefreshOnReturn({ hiddenForMs: 4_000, holds: 0 })).toBe(false);
  });

  it("never refreshes a page that was not hidden", () => {
    expect(shouldRefreshOnReturn({ hiddenForMs: null, holds: 0 })).toBe(false);
  });

  it("never redraws under an open session or an upload", () => {
    expect(shouldRefreshOnReturn({ hiddenForMs: 600_000, holds: 1 })).toBe(false);
    expect(refreshHolds()).toBe(0);
    const releaseSession = holdRefresh();
    const releaseUpload = holdRefresh();
    expect(refreshHolds()).toBe(2);
    releaseSession();
    releaseSession(); // giving a hold back twice counts once
    expect(refreshHolds()).toBe(1);
    releaseUpload();
    expect(refreshHolds()).toBe(0);
  });

  it("is wired into the member shell, the session player and every upload", () => {
    expect(code("app/(player)/layout.tsx")).toContain("<FreshOnReturn />");
    expect(code("app/(free)/layout.tsx")).toContain("<FreshOnReturn />");
    expect(code("components/elite/FreshOnReturn.tsx")).toContain("shouldRefreshOnReturn(");
    expect(code("components/elite/SessionPlayer.tsx")).toContain("holdRefresh()");
    expect(code("lib/elite/clip-upload.ts")).toContain("holdRefresh()");
    // The coach side is not given this behaviour.
    expect(read("app/(coach)/layout.tsx")).not.toContain("FreshOnReturn");
  });
});

describe("phone feel", () => {
  const css = read("app/globals.css");

  it("the page does not bounce past its ends", () => {
    expect(css).toMatch(/html,\s*body\s*{[^}]*overscroll-behavior-y:\s*none/);
  });

  it("controls and pictures cannot be selected or long-pressed into a menu", () => {
    const rule = css.match(/button,[^{]*video\s*{[^}]*}/)?.[0] ?? "";
    expect(rule).toContain("user-select: none");
    expect(rule).toContain("-webkit-touch-callout: none");
    for (const sel of ["button", "nav a", "svg", "img", "video", '[role="switch"]']) {
      expect(rule, sel).toContain(sel);
    }
    // Text a person may want to copy is not covered by that rule.
    expect(rule).not.toMatch(/(^|,\s*)(p|body|main|div)\s*(,|{)/);
  });

  it("a field is never under 16 px on a touch screen, so the phone never zooms in", () => {
    expect(css).toMatch(
      /@media \(pointer: coarse\)\s*{\s*input,\s*textarea,\s*select\s*{\s*font-size:\s*16px\s*!important/
    );
    expect(read("app/layout.tsx")).toMatch(/maximumScale:\s*1/);
  });
});

describe("notifications are asked for once, right after a finish screen", () => {
  it("asks a phone that can be asked, and tells an iPhone in a browser how", () => {
    expect(finishAsk({ step: "enable", asked: false, example: false })).toBe("enable");
    expect(finishAsk({ step: "install_ios", asked: false, example: false })).toBe("install_ios");
  });

  it("asks nothing when already on, blocked, or not offered", () => {
    expect(finishAsk({ step: "resync", asked: false, example: false })).toBeNull();
    expect(finishAsk({ step: "none", asked: false, example: false })).toBeNull();
  });

  it("never asks twice, and never asks the example player", () => {
    expect(finishAsk({ step: "enable", asked: true, example: false })).toBeNull();
    expect(finishAsk({ step: "install_ios", asked: true, example: false })).toBeNull();
    expect(finishAsk({ step: "enable", asked: false, example: true })).toBeNull();
  });

  it("the ask follows the finish screen and is nowhere at the top of a page", () => {
    const layout = code("app/(player)/layout.tsx");
    expect(layout).not.toContain("<PushOptIn");
    expect(layout).toContain("<PushKeepAlive />");
    const player = code("components/elite/SessionPlayer.tsx");
    // Its own screen, reached from Done on the finish screen, so the
    // button to answer it is always in reach of a thumb. The finish
    // screen itself stays the ring, the minutes and Done.
    expect(player).toContain("useNotificationsAsk(Boolean(playerId) && !example)");
    expect(player).toMatch(/function leaveFinish\(\) \{\s*if \(!ask\) return onClose\(\);\s*shown\(\);\s*setAsking\(true\);/);
    expect(player).toContain("<PushOptIn ask={ask} onDone={onClose} coachTime={sendClips !== false} />");
    expect(player).toContain("onClose={leaveFinish}");
    const finish = player.slice(player.indexOf("function Finish("));
    expect(finish).not.toContain("PushOptIn");
    const card = code("components/elite/PushOptIn.tsx");
    expect(card).toContain("finishAsk(");
    expect(card).toContain("markAsked()");
    expect(PUSH_ASKED_KEY).toBe("strive_push_asked");
    expect(card).toContain("PUSH_ASKED_KEY");
    // The Account switch is still the way to turn them on or off later.
    expect(read("components/elite/DeviceSettings.tsx")).toContain("Turn on");
    expect(read("components/elite/DeviceSettings.tsx")).toContain("Turn off");
  });

  it("the ask is one plain line of why, in the house voice", () => {
    const card = code("components/elite/PushOptIn.tsx");
    // the line is said from one place for the website and the iPhone app
    // (lib/elite/notices.ts whyNotifications): only what this member gets
    expect(card).toContain("whyNotifications({ coachTime, friends: false })");
    const why = code("lib/elite/notices.ts");
    expect(why).toContain("So you know the moment your new week is here");
    expect(card).not.toMatch(/—|\bAI\b|automated|algorithm|don't miss|hurry/i);
  });
});
