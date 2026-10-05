import { describe, expect, it } from "vitest";
import { auditWeekRows } from "@/lib/elite/health";
import { filmedBankOnly } from "@/lib/elite/data";
import type { Drill } from "@/lib/elite/types";

describe("auditWeekRows (live-week invariants)", () => {
  const good = (week: number) => ({ week, video_url: "https://v/x", drill_id: "d", drill_active: true });
  it("clean week: no issues", () => {
    expect(auditWeekRows("Elias", 7, [good(6), good(7), good(7)])).toEqual([]);
  });
  it("no plan for the live week", () => {
    const out = auditWeekRows("Mason", 5, [good(4)]);
    expect(out).toHaveLength(1);
    expect(out[0].issue).toMatch(/no plan for live week 5/);
  });
  it("flags missing video, missing link, and inactive drill separately", () => {
    const out = auditWeekRows("Abdul", 2, [
      { week: 2, video_url: null, drill_id: "d", drill_active: true },
      { week: 2, video_url: "https://v", drill_id: null, drill_active: null },
      { week: 2, video_url: "https://v", drill_id: "gone", drill_active: null },
    ]);
    expect(out.map((i) => i.issue).join(" | ")).toMatch(/1 drill without a video.*1 drill not linked.*1 drill linked to a missing/);
  });
});

describe("filmedBankOnly", () => {
  const d = (title: string, video_url: string | null) => ({ title, video_url } as Drill);
  it("never returns the starter library, even if it had videos", () => {
    expect(filmedBankOnly([d("a", "https://v")], false)).toEqual([]);
  });
  it("keeps only filmed drills from the real bank", () => {
    expect(filmedBankOnly([d("a", "https://v"), d("b", null), d("c", "")], true).map((x) => x.title)).toEqual(["a"]);
  });
});
