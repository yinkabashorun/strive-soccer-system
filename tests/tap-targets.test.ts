import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

// App Store punch list A3: every control a member taps is at least a
// 44 x 44 finger target (Apple's minimum). These are the controls that
// were under it on Nov 18 2026; each is pinned to its fix here so none of
// them shrinks back. The walk that found them measured every member
// screen at 390 x 844.

// Every <a> and <Link> in a file, with its className.
function links(src: string): { tag: string; cls: string }[] {
  return [...src.matchAll(/<(a|Link)\b[^>]*?>/g)].map((m) => ({
    tag: m[0],
    cls: m[0].match(/className="([^"]*)"/)?.[1] ?? "",
  }));
}
const fullSize = (cls: string) => /(^|\s)(tap|py-3|py-3\.5|py-4|min-h-\[(4[4-9]|[5-9]\d)px\]|h-1[1-9]|h-\[(4[4-9]|[5-9]\d)px\])(\s|$)/.test(cls);

describe("finger targets", () => {
  it("a text link grows to 44 px without moving its line", () => {
    const css = read("app/globals.css");
    const rule = css.match(/\.tap\s*{[^}]*}/)?.[0] ?? "";
    expect(rule).toContain("display: inline-block");
    const pad = Number(rule.match(/padding:\s*(\d+)px/)?.[1] ?? 0);
    // The smallest line a link sits in here is 16 px tall.
    expect(16 + 2 * pad).toBeGreaterThanOrEqual(44);
    expect(rule).toMatch(new RegExp(`margin:\\s*-${pad}px`));
  });

  it("every link on the support and legal pages is a full-size target", () => {
    for (const f of ["app/support/page.tsx", "app/privacy/page.tsx", "app/terms/page.tsx"]) {
      for (const l of links(code(f))) expect(fullSize(l.cls), `${f}: ${l.tag}`).toBe(true);
    }
  });

  it("every link on the sign-in, forgot and sign-up screens is a full-size target", () => {
    for (const f of [
      "components/elite/LoginForm.tsx",
      "components/elite/ForgotForm.tsx",
      "components/elite/SignupForm.tsx",
      "components/elite/AgreementScreen.tsx",
      "app/(auth)/layout.tsx",
    ]) {
      for (const l of links(code(f))) expect(fullSize(l.cls), `${f}: ${l.tag}`).toBe(true);
    }
  });

  it("the bell, the message box and its send button are 44 px", () => {
    expect(code("components/elite/NotificationBell.tsx")).toMatch(/aria-label=\{[^}]*Notifications[^}]*\}[\s\S]{0,160}h-11 w-11/);
    const thread = code("components/elite/MessageThread.tsx");
    expect(thread).toMatch(/<input[\s\S]*?className="h-11 /);
    expect(thread).toMatch(/className="btn-accent h-11 w-11[^"]*"\s+aria-label="Send"/);
  });

  it("the session player's small controls carry a 44 px hit area", () => {
    const player = code("components/elite/SessionPlayer.tsx");
    // Progress marks: a thin bar with a tall invisible hit area.
    expect(player).toMatch(/aria-label=\{`Drill \$\{i \+ 1\}`\}[\s\S]{0,200}before:-inset-y-\[13px\]/);
    // "How to do it" and "Untick it" are text links with the tap class.
    expect(player).toMatch(/className="tap [^"]*"\s*>\s*\{showHow/);
    expect(player).toMatch(/onClick=\{undo\} className="tap /);
    // The three bottom buttons.
    expect((player.match(/h-14 w-12/g) ?? []).length).toBe(2);
  });

  it("the wordmark link and the drill video's close button are 44 px", () => {
    expect(code("components/elite/Wordmark.tsx")).toContain("before:-inset-y-2");
    expect(code("components/elite/DrillVideo.tsx")).toMatch(/h-11 w-11[^"]*"\s+aria-label="Close video"/);
  });

  it("a tick box is tapped through its whole row", () => {
    for (const f of ["components/elite/SignupForm.tsx", "components/elite/AgreementScreen.tsx"]) {
      const src = code(f);
      const boxes = (src.match(/type="checkbox"/g) ?? []).length;
      const rows = (src.match(/<label className="flex min-h-\[44px\]/g) ?? []).length;
      expect(boxes).toBeGreaterThan(0);
      expect(rows, f).toBe(boxes);
    }
  });
});

// A10: inside the App Store app the sign-in screen leads nowhere else.
describe("sign-in inside the App Store app", () => {
  it("shows no link to another website", () => {
    const layout = code("app/(auth)/layout.tsx");
    expect(layout).toContain("inNativeApp()");
    expect(layout).toMatch(/\{!native && \(\s*<a\s+href="https:\/\/strivesoccer100x\.com"/);
  });

  it("offers the example tour once, as a player, and no coach tour", () => {
    const form = code("components/elite/LoginForm.tsx");
    // The one tour button every visitor sees.
    expect((form.match(/See the app as a player/g) ?? []).length).toBe(1);
    // The local set-up block (two more tour buttons, one of them the coach
    // side) never renders inside the app.
    expect(form).toMatch(/\{!configured && !native && \(/);
    const block = form.slice(form.indexOf("{!configured && !native && ("));
    expect(block).toContain("enterDemoCoach");
    expect(form.slice(0, form.indexOf("{!configured && !native && ("))).not.toContain("action={enterDemoCoach}");
    // And creating an account stays off the screen there.
    expect(form).toMatch(/\{!native && \(\s*<p[^>]*>\s*New here\?/);
  });

  it("the website's sign-in keeps its link and its create-account line", () => {
    expect(read("app/(auth)/layout.tsx")).toContain("strivesoccer100x.com ↗");
    expect(read("components/elite/LoginForm.tsx")).toContain("Create an account");
  });
});
