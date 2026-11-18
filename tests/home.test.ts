import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homeMoreItems } from "@/lib/elite/home";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

// App Store punch list A1: Home is one screen. The session card, then one
// quiet row; time trained once, the week once; achievements on Progress.
describe("Home: one thing, then one quiet row", () => {
  it("the quiet row offers at most three folded items, in a fixed order", () => {
    expect(homeMoreItems({ hasWeek: true, hasCoachNote: true, canSetBreak: true }).map((i) => i.key)).toEqual([
      "extra",
      "coach",
      "break",
    ]);
    expect(homeMoreItems({ hasWeek: true, hasCoachNote: false, canSetBreak: false }).map((i) => i.label)).toEqual([
      "Extra work",
    ]);
    // A new member with no week yet can still set a break and read a note.
    expect(homeMoreItems({ hasWeek: false, hasCoachNote: true, canSetBreak: true }).map((i) => i.key)).toEqual([
      "coach",
      "break",
    ]);
    expect(homeMoreItems({ hasWeek: false, hasCoachNote: false, canSetBreak: false })).toEqual([]);
  });

  it("nothing but the session card and the quiet row is always on Home", () => {
    const page = code("app/(player)/dashboard/page.tsx");
    expect(page).toContain("<TodaySession");
    expect(page).toContain("<HomeMore");
    // Gone from Home: the stats strip, the achievements grid, the always-on
    // Extra Work card, the coach's note card and the break one-liner.
    expect(page).not.toContain("StatTile");
    expect(page).not.toContain("getAchievements");
    expect(page).not.toMatch(/achievements/i);
    expect(page).not.toContain("<ExtraWork");
    expect(page).not.toMatch(/<BreakCard current=\{null\}/);
    // The Training tab is the full week; Home does not link to it twice.
    expect(page).not.toContain('href="/homework"');
  });

  it("time trained shows once and opens Progress; the week shows once, on the session card", () => {
    const page = code("app/(player)/dashboard/page.tsx");
    const jsx = page.slice(page.indexOf("return (\n    <div"));
    // One visible duration (the pill); the aria-label names it for a screen reader.
    expect((jsx.match(/(?<!\$)\{fmtDuration\(time\.minutes\)\}/g) ?? []).length).toBe(1);
    expect(jsx).toMatch(/<Link\s+href="\/progress"[\s\S]{0,200}min-h-\[44px\]/);
    // The header no longer repeats the week; the card carries it.
    const header = jsx.slice(jsx.indexOf("<header"), jsx.indexOf("</header>"));
    expect(header).not.toMatch(/Week \{/);
    expect(code("components/elite/TodaySession.tsx")).toMatch(/Week \{week\}/);
  });

  it("the folded items open in place and say what they are", () => {
    const more = code("components/elite/HomeMore.tsx");
    expect(more).toContain("homeMoreItems(");
    expect(more).toContain("aria-expanded={on}");
    expect(more).toContain("<ExtraWork");
    expect(more).toContain("<BreakCard");
    expect(more).toContain('href="/messages"');
    expect(more).toMatch(/min-h-\[56px\]/);
    expect(more).not.toMatch(/—|\bAI\b|automated|algorithm|streak/i);
  });

  it("the session rows on Home are compact and still a full finger target", () => {
    expect(code("components/elite/TodaySession.tsx")).toMatch(/<SessionRows[\s\S]*?compact\s*\/>/);
    const rows = code("components/elite/SessionRows.tsx");
    expect(rows).toMatch(/compact \? "h-\[52px\]" : "h-16"/);
    expect(rows).toContain("w-14");
  });

  it("achievements live on the Progress page", () => {
    const progress = code("app/(player)/progress/page.tsx");
    expect(progress).toContain("getAchievements(");
    expect(progress).toContain("<Achievements achievements={achievements} />");
  });

  it("the shell leaves room for the tab bar and the phone's home indicator, no more", () => {
    expect(read("app/(player)/layout.tsx")).toContain("pb-[calc(5.25rem+env(safe-area-inset-bottom))]");
  });
});
