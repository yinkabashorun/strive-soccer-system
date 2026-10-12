import { describe, expect, it } from "vitest";
import { currentBreak, isOnBreak, resumeAnchor, weekHasOpenWork } from "@/lib/elite/breaks";

// Offer stack item 8 (Oct 12 2026): a break is a date, not a penalty. The
// program clock only ever moves LATER, by whole weeks, and only when the
// calendar ran ahead of the player while they were away.
describe("currentBreak", () => {
  const breaks = [{ since: "2026-10-05", until: "2026-10-18" }];
  it("is on break from the first day to the last day inclusive", () => {
    expect(isOnBreak(breaks, "2026-10-05")).toBe(true);
    expect(isOnBreak(breaks, "2026-10-18")).toBe(true);
    expect(isOnBreak(breaks, "2026-10-04")).toBe(false);
    expect(isOnBreak(breaks, "2026-10-19")).toBe(false);
    expect(currentBreak([], "2026-10-10")).toBeNull();
  });
});

describe("resumeAnchor", () => {
  // Program started Monday Sept 7 2026. Player built through week 5
  // (Oct 5 to Oct 11), left for two weeks, back Wednesday Oct 21 - the
  // calendar says week 7.
  const week1Monday = "2026-09-07";
  it("no clock, no weeks: nothing to move", () => {
    expect(resumeAnchor({ week1Monday: null, maxBuilt: 3, openWork: false, today: "2026-10-21" })).toBeNull();
    expect(resumeAnchor({ week1Monday, maxBuilt: 0, openWork: false, today: "2026-10-21" })).toBeNull();
  });
  it("finished week 5, back in calendar week 7: week 6 starts this Monday", () => {
    expect(resumeAnchor({ week1Monday, maxBuilt: 5, openWork: false, today: "2026-10-21" })).toBe("2026-09-14");
  });
  it("left week 5 half done: week 5 is this week again", () => {
    expect(resumeAnchor({ week1Monday, maxBuilt: 5, openWork: true, today: "2026-10-21" })).toBe("2026-09-21");
  });
  it("a short break inside the same week moves nothing (never backwards)", () => {
    expect(resumeAnchor({ week1Monday, maxBuilt: 5, openWork: true, today: "2026-10-09" })).toBeNull();
    expect(resumeAnchor({ week1Monday, maxBuilt: 5, openWork: false, today: "2026-10-14" })).toBeNull(); // calendar week 6 = target
  });
  it("back on a Sunday with the next week still to build: it starts tomorrow", () => {
    // Sunday Oct 25 2026 is calendar week 8; week 6 should begin Monday Oct 26.
    expect(resumeAnchor({ week1Monday, maxBuilt: 5, openWork: false, today: "2026-10-25" })).toBe("2026-09-21");
  });
  it("back on a Sunday to an unfinished week: that week is live today", () => {
    expect(resumeAnchor({ week1Monday, maxBuilt: 5, openWork: true, today: "2026-10-25" })).toBe("2026-09-21");
  });
  it("the new anchor is always a Monday", () => {
    const a = resumeAnchor({ week1Monday, maxBuilt: 2, openWork: false, today: "2026-11-05" });
    expect(a && new Date(a + "T00:00:00Z").getUTCDay()).toBe(1);
  });
});

describe("weekHasOpenWork", () => {
  it("an unfinished extra never holds a player back", () => {
    expect(weekHasOpenWork([{ week: 5, completed: false, is_extra: true }], 5)).toBe(false);
    expect(weekHasOpenWork([{ week: 5, completed: false, is_extra: false }], 5)).toBe(true);
    expect(weekHasOpenWork([{ week: 4, completed: false }], 5)).toBe(false);
  });
});
