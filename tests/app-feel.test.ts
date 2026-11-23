import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { perRequest } from "../lib/elite/request-cache";
import {
  COMMIT_FRACTION,
  axisOf,
  entranceBetween,
  followFinger,
  setEntrance,
  swipeOutcome,
  tabIndex,
  takeEntrance,
} from "../lib/elite/tab-motion";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Nov 23 2026, Coach Yinka on the first TestFlight build: "when im
// clicking things there is a delay, when i am swiping through its not
// smooth like how instagram or snapchat is". These hold what made it fast.

describe("speed: nothing extra in front of a tap", () => {
  it("the Monday unlock is off the member shell; the hourly builder does it first thing", () => {
    const layout = read("app/(player)/layout.tsx");
    expect(layout).not.toMatch(/import \{ unlockDueWeeks \}/);
    expect(layout).not.toMatch(/await unlockDueWeeks\(/);
    const cron = read("app/api/elite/cron/weekly-plans/route.ts");
    const unlock = cron.indexOf("await unlockDueWeeks()");
    expect(unlock).toBeGreaterThan(-1);
    // before the Sunday early return and before the builder runs
    expect(unlock).toBeLessThan(cron.indexOf("isSundayEveNY() && nyHour() < 15"));
    expect(unlock).toBeLessThan(cron.indexOf("runPlanBuilder("));
    // and the cron runs every hour
    expect(read("vercel.json")).toMatch(/"path": "\/api\/elite\/cron\/weekly-plans",\s*"schedule": "0 \* \* \* \*"/);
  });

  it("the shell reads the agreement, the player, the bell and the week side by side", () => {
    const layout = read("app/(player)/layout.tsx");
    expect(layout).toMatch(
      /const \[consent, player, notifications, homework\] = await Promise\.all\(\[\s*viewer\.demo \? false : consentDue\(viewer\.profile\.id\),\s*getPlayer\(viewer\.playerId\),\s*getNotifications\(viewer\.playerId\),\s*getHomework\(viewer\.playerId\),\s*\]\)/
    );
  });

  it("who is signed in, the player and the week are read once per request", () => {
    expect(read("lib/elite/session.ts")).toContain("export const getViewer = perRequest(readViewer);");
    const data = read("lib/elite/data.ts");
    for (const fn of ["getPlayer", "getHomework", "getNotifications"]) {
      expect(data).toContain(`export const ${fn} = perRequest(async function ${fn}(`);
    }
    // the profile and the player row are read side by side, not in turn
    expect(read("lib/elite/session.ts")).toMatch(/await Promise\.all\(\[\s*supabase\.from\("elite_profiles"\)[\s\S]*supabase\.from\("elite_players"\)/);
  });

  it("perRequest hands the function back as it is where React's cache is not there", () => {
    const fn = async (x: number) => x + 1;
    expect(perRequest(fn)).toBe(fn);
  });

  it("a screen the phone has is shown again without asking, and every tab is fetched ahead", () => {
    const config = read("next.config.js");
    expect(config).toMatch(/staleTimes: \{\s*dynamic: 30,\s*static: 180,\s*\}/);
    const nav = read("components/elite/MemberNav.tsx");
    expect(nav).toContain("const warm = () => all.forEach((h) => router.prefetch(h));");
    expect(nav.match(/\bprefetch\n/g)!.length).toBe(2); // the rail and the bar
    expect(read("components/elite/SwipeTabs.tsx")).toContain("router.prefetch(tabs[i])");
  });

  it("anything a member does still empties that cache, so nothing is stale after an action", () => {
    const actions = read("lib/elite/player-actions.ts");
    for (const fn of ["toggleHomework", "submitCheckin", "sendPlayerMessage"]) {
      const body = actions.slice(actions.indexOf(`export async function ${fn}(`));
      const end = body.indexOf("\nexport async function ", 10);
      expect(body.slice(0, end > 0 ? end : undefined), fn).toContain("revalidatePath(");
    }
    expect(read("lib/elite/extra-actions.ts")).toContain("revalidatePath(");
  });

  it("the placeholder shows at once, not after a blank third of a second", () => {
    const loading = read("app/(player)/loading.tsx");
    expect(loading).not.toMatch(/animation-delay/);
    expect(loading).toContain("data-skeleton");
  });
});

describe("glide: the tab answers as the finger lands", () => {
  it("the bar lights on pointerdown, and lets go if the finger slides off", () => {
    const nav = read("components/elite/MemberNav.tsx");
    expect(nav).toContain("const lit = pressed ?? current;");
    expect(nav).toContain("onPointerDown={() => press(t.href)}");
    expect(nav).toContain("onPointerCancel={() => setPressed(null)}");
    expect(nav).toContain("useEffect(() => setPressed(null), [pathname]);");
    // aria-current stays the real screen, for screen readers
    expect(nav).toContain('aria-current={t.href === current ? "page" : undefined}');
  });

  it("every card and button sinks a touch the instant it is pressed, and not with reduced motion", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/\.member-ui a:not\(\.tap\):not\(\.no-press\):active,[\s\S]*transform: scale\(0\.97\);/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.member-ui a:not\(\.tap\)/);
    // no 300 ms wait and no grey flash on a tap
    expect(css).toContain("touch-action: manipulation;");
    expect(css).toContain("-webkit-tap-highlight-color: transparent;");
  });

  it("screens come in from their side in 0.3 s, a fade with reduced motion, and leave no transform behind", () => {
    const tw = read("tailwind.config.ts");
    for (const name of ["screen-in", "screen-from-right", "screen-from-left", "screen-nudge-right", "screen-nudge-left"]) {
      expect(tw).toMatch(new RegExp(`"${name}": "${name} 0\\.2[48]s cubic-bezier\\(0\\.22,1,0\\.36,1\\) backwards"`));
    }
    const css = read("app/globals.css");
    expect(css).toMatch(/\.animate-screen-nudge-left \{\s*animation: fade-in 0\.2s ease-out backwards !important;/);
    expect(read("app/(player)/template.tsx")).toContain("<TabEntrance>");
  });
});

describe("glide: the swipe between tabs", () => {
  const tabs = ["/dashboard", "/homework", "/courses", "/you"];

  it("only a tab's own screen swipes", () => {
    expect(tabIndex("/homework", tabs)).toBe(1);
    expect(tabIndex("/courses/keep-it-up", tabs)).toBe(-1);
    expect(tabIndex("/progress", tabs)).toBe(-1);
  });

  it("sideways only when clearly sideways, so a scroll stays a scroll", () => {
    expect(axisOf(4, 3)).toBeNull();
    expect(axisOf(40, 10)).toBe("x");
    expect(axisOf(20, 18)).toBe("y");
    expect(axisOf(2, 30)).toBe("y");
  });

  it("follows the finger, and only a quarter as far past the last tab", () => {
    expect(followFinger(-100, true)).toBe(-100);
    expect(followFinger(100, false)).toBe(25);
  });

  it("a long drag or a quick flick changes the tab; anything else springs back", () => {
    const w = 393;
    expect(swipeOutcome({ dx: -w * COMMIT_FRACTION, dt: 600, width: w, index: 1, count: 4 })).toBe("next");
    expect(swipeOutcome({ dx: w * 0.3, dt: 600, width: w, index: 1, count: 4 })).toBe("prev");
    expect(swipeOutcome({ dx: -60, dt: 100, width: w, index: 1, count: 4 })).toBe("next"); // a flick
    expect(swipeOutcome({ dx: -60, dt: 400, width: w, index: 1, count: 4 })).toBeNull(); // slow and short
    expect(swipeOutcome({ dx: -200, dt: 300, width: w, index: 3, count: 4 })).toBeNull(); // no tab after the last
    expect(swipeOutcome({ dx: 200, dt: 300, width: w, index: 0, count: 4 })).toBeNull(); // none before the first
    expect(swipeOutcome({ dx: -200, dt: 300, width: w, index: -1, count: 4 })).toBeNull(); // not a tab screen
  });

  it("the next screen comes in from the side it was asked for, once", () => {
    expect(entranceBetween(1, 2)).toBe("from-right");
    expect(entranceBetween(2, 1)).toBe("from-left");
    expect(entranceBetween(0, 3, "tap")).toBe("nudge-right");
    expect(entranceBetween(1, 1)).toBe("fade");
    setEntrance("from-left");
    expect(takeEntrance()).toBe("from-left");
    expect(takeEntrance()).toBe("fade");
  });

  it("leaves sheets, players, fields, video and sideways rows alone, and never blocks a vertical scroll", () => {
    const swipe = read("components/elite/SwipeTabs.tsx");
    expect(swipe).toContain('[role="dialog"], [aria-modal="true"], input, textarea, select, [contenteditable="true"], video, [data-no-swipe]');
    expect(swipe).toContain("scrollsSideways(target, el)");
    expect(swipe).toContain('touchAction: "pan-y pinch-zoom"');
    expect(swipe).toMatch(/addEventListener\("touchmove", onMove, \{ passive: true \}\)/);
    // no resting transform or will-change: the box must never become the
    // frame of a fixed sheet inside it
    expect(swipe).not.toMatch(/will-change/);
    // reduced motion: nothing follows the finger
    expect(swipe).toMatch(/if \(reduced\) return;\s*const hasNeighbor/);
  });
});

describe("sign-up, Instagram style: one thing a screen", () => {
  it("the main button is pinned to the bottom and rides above the keyboard", () => {
    expect(read("components/elite/OnboardingShell.tsx")).toContain("window.innerHeight - vv.height - vv.offsetTop");
    for (const f of ["components/elite/JoinForm.tsx", "components/elite/QuizFlow.tsx", "components/elite/OnboardingShell.tsx"]) {
      expect(read(f), f).toMatch(/style=\{\{ bottom: kb \}\}/);
    }
  });

  it("each screen says what is wrong in its own words, never the browser's bubble", () => {
    const join = read("components/elite/JoinForm.tsx");
    expect(join).toMatch(/onSubmit=\{onSubmit\}\s*\/\/[^\n]*\n[^\n]*\n\s*noValidate/);
    expect(join).toContain("if (!guardian || !terms) {");
    const pro = read("components/elite/ProJoinForm.tsx");
    expect(pro).toContain("if (!guardian || !terms) return setError(TICK_BOTH);");
    expect(pro).toContain("joinProblem({ firstName, lastName, email, phone, password }, here)");
  });

  it("Strive Pro sign-up is the same screens as the free one, not a second set", () => {
    const pro = read("components/elite/ProJoinForm.tsx");
    expect(pro).toContain('import { Foot, Input, Question, Screen, TICK_BOTH } from "./JoinForm";');
    expect(pro).toContain('const STEPS: Step[] = ["age", "name", "contact", "password", "agree"];');
    expect(pro).not.toContain("<select");
  });

  it("the first field of a typed screen has the keyboard up as it lands", () => {
    expect(read("components/elite/JoinForm.tsx").match(/autoFocus\b/g)!.length).toBeGreaterThanOrEqual(4);
    expect(read("components/elite/ProJoinForm.tsx").match(/ autoFocus\b|\n\s*autoFocus\n/g)!.length).toBeGreaterThanOrEqual(3);
    expect(read("components/elite/ProfileSetup.tsx")).toContain("<UsernameInput value={name} onChange={setName} state={state} autoFocus onEnter={takeName} />");
  });
});
