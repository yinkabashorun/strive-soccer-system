import { describe, expect, it } from "vitest";
import { ownsProgressPath, progressPath } from "@/lib/elite/clips";
import {
  DEFAULT_BENCHMARK_TITLE,
  fallbackBenchmark,
  isFirstClipWeek,
  isProgressVideoWeek,
  previousProgressVideo,
  progressVideoDue,
} from "@/lib/elite/progress-video";
import type { Homework } from "@/lib/elite/types";

// Offer stack item 7 (Oct 13 2026): the same drill, every second week.
const P = "8f0a3b4c-1d2e-4f5a-9b6c-7d8e9f0a1b2c";

describe("progress video cadence", () => {
  it("is the first clip in week 1, then every second week", () => {
    expect([1, 2, 3, 4, 5, 6].map(isProgressVideoWeek)).toEqual([true, true, false, true, false, true]);
    expect(isFirstClipWeek(1)).toBe(true);
    expect(isFirstClipWeek(2)).toBe(false);
  });
  it("the default drill is the freestyle dribbling drill", () => {
    expect(DEFAULT_BENCHMARK_TITLE).toBe("8-cone freestyle");
  });
  it("is due once per progress week", () => {
    expect(progressVideoDue(4, [{ week: 2 }])).toBe(true);
    expect(progressVideoDue(4, [{ week: 2 }, { week: 4 }])).toBe(false);
    expect(progressVideoDue(3, [])).toBe(false);
  });
  it("finds the previous one for the two-weeks-ago line", () => {
    expect(previousProgressVideo(6, [{ week: 2 }, { week: 4 }])?.week).toBe(4);
    expect(previousProgressVideo(2, [{ week: 1 }])?.week).toBe(1);
    expect(previousProgressVideo(1, [])).toBeNull();
  });
});

describe("fallback benchmark", () => {
  const row = (title: string, completed_at: string | null, drill_id = "d"): Homework =>
    ({ id: title, player_id: P, week: 1, title, exercise: "", reps: "", video_url: "https://v", notes: null,
       completed: Boolean(completed_at), completed_at, sort: 0, drill_id } as Homework);
  it("is the first SKILL drill ever completed, never a warm-up or finisher", () => {
    const b = fallbackBenchmark([
      row("Plyo warm-up: Pogo", "2026-09-01T10:00:00Z"),
      row("Strength: Core A", "2026-09-01T10:05:00Z"),
      row("Ronaldinho drill", "2026-09-02T10:00:00Z", "ron"),
      row("Neymar Feint", "2026-09-01T10:30:00Z", "ney"),
    ]);
    expect(b?.title).toBe("Neymar Feint");
    expect(b?.drill_id).toBe("ney");
  });
  it("is null before anything is completed", () => {
    expect(fallbackBenchmark([row("Ronaldinho drill", null)])).toBeNull();
  });
});

describe("progress paths", () => {
  it("builds and checks the convention the storage policy accepts", () => {
    const p = progressPath(P, 4, "mp4", 7);
    expect(p).toBe(`progress/${P}/4/7.mp4`);
    expect(ownsProgressPath(p, P, 4)).toBe(true);
    expect(ownsProgressPath(p, P, 6)).toBe(false);
    expect(ownsProgressPath(`clips/${P}/4/7.mp4`, P, 4)).toBe(false);
    expect(ownsProgressPath(`progress/${P}/04/7.mp4`, P, 4)).toBe(false);
  });
});
