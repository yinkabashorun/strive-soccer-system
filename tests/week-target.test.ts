import { describe, expect, it } from "vitest";
import { builderTargetWeek, resolveWeekTarget } from "@/lib/elite/week-target";

// These encode the Oct 1 2026 stale-week bug. If any of them fail, a
// player would end up training a week that already ended.
describe("resolveWeekTarget", () => {
  it("first week goes live now and anchors to this Monday on a weekday", () => {
    const t = resolveWeekTarget({ firstWeek: true, liveWeek: 1, maxBuilt: 0, sundayEve: false });
    expect(t).toMatchObject({ week: 1, goesLiveNow: true, mode: "first", anchorOffsetWeeks: 0 });
  });
  it("first week published on a Sunday anchors to NEXT Monday (never a one-day week 1)", () => {
    const t = resolveWeekTarget({ firstWeek: true, liveWeek: 1, maxBuilt: 0, sundayEve: true });
    expect(t.anchorOffsetWeeks).toBe(1);
    expect(t.goesLiveNow).toBe(true);
  });
  it("behind on a weekday: builds the live week and goes live now", () => {
    const t = resolveWeekTarget({ firstWeek: false, liveWeek: 7, maxBuilt: 6, sundayEve: false });
    expect(t).toMatchObject({ week: 7, goesLiveNow: true, mode: "catch_up" });
  });
  it("behind on a SUNDAY: builds NEXT week, held to Monday - never the dying week", () => {
    const t = resolveWeekTarget({ firstWeek: false, liveWeek: 6, maxBuilt: 2, sundayEve: true });
    expect(t).toMatchObject({ week: 7, goesLiveNow: false, mode: "next" });
  });
  it("steady state (live week built): next week, held to Monday", () => {
    const t = resolveWeekTarget({ firstWeek: false, liveWeek: 6, maxBuilt: 6, sundayEve: true });
    expect(t).toMatchObject({ week: 7, goesLiveNow: false });
  });
  it("replaces an already-scheduled pending week instead of fast-forwarding", () => {
    const t = resolveWeekTarget({ firstWeek: false, liveWeek: 6, maxBuilt: 7, sundayEve: true, pendingWeek: 7 });
    expect(t.week).toBe(7);
    expect(t.goesLiveNow).toBe(false);
  });
  it("never goes live now for a week beyond the live one", () => {
    for (const sundayEve of [true, false]) {
      for (let maxBuilt = 0; maxBuilt <= 9; maxBuilt++) {
        const t = resolveWeekTarget({ firstWeek: false, liveWeek: 7, maxBuilt, sundayEve });
        if (t.goesLiveNow) expect(t.week).toBe(7);
      }
    }
  });
});

describe("builderTargetWeek", () => {
  it("no clock yet: week 1 any day", () => {
    expect(builderTargetWeek({ hasClock: false, liveWeek: 1, sundayEve: false })).toBe(1);
    expect(builderTargetWeek({ hasClock: false, liveWeek: 1, sundayEve: true })).toBe(1);
  });
  it("weekday: responsible for the live week only (no mid-week pre-build)", () => {
    expect(builderTargetWeek({ hasClock: true, liveWeek: 7, sundayEve: false })).toBe(7);
  });
  it("Sunday: responsible for the week starting tomorrow", () => {
    expect(builderTargetWeek({ hasClock: true, liveWeek: 7, sundayEve: true })).toBe(8);
  });
});
