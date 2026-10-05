import { describe, expect, it } from "vitest";
import { EmptyBankError, methodologyContext, METHOD_PILLARS } from "@/lib/elite/methodology";
import { conformSessionsToBank } from "@/lib/elite/bank-conform";
import type { Drill } from "@/lib/elite/types";

// Coach Yinka, Oct 2 2026: "delete any drills that do not have a video
// attached." The only drills that exist are the filmed bank rows. These
// tests fail the build if any code path can produce a drill from anywhere
// else.
describe("no built-in drill library", () => {
  it("the methodology carries pillars and lenses only, no drill lists", () => {
    for (const g of METHOD_PILLARS) {
      expect(Object.keys(g).sort()).toEqual(["lens", "pillar"]);
    }
  });
  it("the AI prompt refuses to build with no filmed skill drills", () => {
    expect(() => methodologyContext([])).toThrow(EmptyBankError);
    expect(() => methodologyContext(undefined)).toThrow(EmptyBankError);
    const plyoOnly = [{ title: "Plyo warm-up: Pogo jumps", pillar: "Plyo", how: "", reps: "", minutes: 4, cues: "", needs_wall: false } as Drill];
    expect(() => methodologyContext(plyoOnly)).toThrow(EmptyBankError);
  });
  it("the prompt lists exactly the bank's skill drills, nothing else", () => {
    const bank = [
      { title: "Maradona", pillar: "Confidence", how: "h", reps: "3 x 12", minutes: 9, cues: "", needs_wall: false },
      { title: "Plyo warm-up: Pogo jumps", pillar: "Plyo", how: "", reps: "", minutes: 4, cues: "", needs_wall: false },
    ] as Drill[];
    const ctx = methodologyContext(bank);
    expect(ctx).toContain("Maradona");
    expect(ctx).not.toContain("Pogo");
    expect(ctx).not.toMatch(/Inside-outside cone weave|Foundations|Driven wall/);
  });
  it("a thin session is filled to three skill drills from the bank, never padded", () => {
    const bank = ["A", "B", "C", "D"].map(
      (t) => ({ id: t, title: t, pillar: "Ball Mastery", how: "how", reps: "3 x 10", minutes: 6, cues: "", needs_wall: false, active: true, video_url: "https://v/" + t, sort: 0 }) as Drill
    );
    const out = conformSessionsToBank([{ title: "S1", drills: [{ title: "A", exercise: "x", reps: "x" }] }, { title: "S2", drills: [] }], bank, null, "");
    for (const s of out) {
      expect(s.drills).toHaveLength(3);
      for (const d of s.drills) expect(bank.some((b) => b.title === d.title)).toBe(true);
    }
  });
});
