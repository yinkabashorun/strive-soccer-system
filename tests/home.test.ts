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

  it("time trained shows once and opens You; the week shows once, in the header", () => {
    // The approved Home (mock v4): the day and "Week 7 · Nov 24" at the
    // top; time trained, all time, once, under the card, opening You.
    const page = code("app/(player)/dashboard/page.tsx");
    const jsx = page.slice(page.indexOf("return (\n    <div"));
    expect(jsx).not.toMatch(/fmtDuration\(/);
    const header = jsx.slice(jsx.indexOf("<header"), jsx.indexOf("</header>"));
    expect(header).toMatch(/Week \$\{contentWeek\}/);
    const card = code("components/elite/TodaySession.tsx");
    const line = card.slice(card.indexOf("function WeekLine("), card.indexOf("function VictoryLap("));
    expect((line.match(/\{fmtDuration\(minutes\)\}/g) ?? []).length).toBe(1);
    expect(card).toMatch(/<Link href="\/you" className="press min-h-\[44px\]/);
    // The card itself never repeats the week.
    const hero = card.slice(card.indexOf("<section"), card.indexOf("</section>"));
    expect(hero).not.toMatch(/Week \{week\}/);
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

  it("the drills on the Home card are pictures, each a full finger target that opens it", () => {
    const card = code("components/elite/TodaySession.tsx");
    expect(card).toMatch(/aria-label=\{`Open drill \$\{i \+ 1\}`\}\s*className="press relative h-16 flex-1/);
    expect(card).toContain("current.list.slice(0, 4)");
    // One main button on the card: Start (or Continue) session.
    expect((card.match(/className="m-button/g) ?? []).length).toBe(1);
  });

  it("achievements live on the Progress page", () => {
    const progress = code("app/(player)/progress/page.tsx");
    expect(progress).toContain("getAchievements(");
    expect(progress).toContain("<Achievements achievements={achievements} />");
  });

  it("the shell leaves room for the tab bar and the phone's home indicator, no more", () => {
    // The approved tab bar is taller (icon, label and the gold dot) with a
    // short fade above it; the last card scrolls fully clear of both.
    expect(read("app/(player)/layout.tsx")).toContain("pb-[calc(7.5rem+env(safe-area-inset-bottom))]");
    // The bar is solid black behind the tabs, so page text never reads through it.
    expect(read("components/elite/MemberNav.tsx")).toMatch(
      /aria-label="Tabs"[\s\S]{0,300}className="fixed inset-x-0 bottom-0 z-40 bg-black pb-safe/
    );
  });
});
