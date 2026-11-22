import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { areaName, timeByArea } from "@/lib/elite/time-trained";
import type { Homework } from "@/lib/elite/types";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

// Time by area (Nov 22 2026): the minutes of every completed drill under
// its area, in the player's words, with this week beside all time.
const row = (p: Partial<Homework>): Homework =>
  ({ id: Math.random().toString(), week: 1, session: 1, title: "x", completed: true, duration_min: 10, pillar: "Weak Foot", ...p }) as Homework;

describe("time by area", () => {
  it("adds completed minutes per area, this week beside all time, largest first", () => {
    const out = timeByArea(
      [
        row({ week: 1, pillar: "Weak Foot", duration_min: 10 }),
        row({ week: 2, pillar: "Weak Foot", duration_min: 15 }),
        row({ week: 2, pillar: "Confidence", duration_min: 5 }),
        row({ week: 2, pillar: "Speed", duration_min: 40, completed: false }),
        row({ week: 2, pillar: null as unknown as string }),
      ],
      2
    );
    expect(out).toEqual([
      { area: "Weak foot", minutes: 25, thisWeek: 15 },
      { area: "1v1 moves", minutes: 5, thisWeek: 5 },
    ]);
  });

  it("a drill with no minutes counts 15, as everywhere else", () => {
    expect(timeByArea([row({ duration_min: null as unknown as number })], 1)[0].minutes).toBe(15);
  });

  it("names the areas in the player's words", () => {
    expect(areaName("Confidence")).toBe("1v1 moves");
    expect(areaName("Strengthening")).toBe("Strength");
    expect(areaName("Plyo")).toBe("Plyo warm-ups");
    expect(areaName("Something new")).toBe("Something new");
  });

  it("is on the You tab, and the ratings no longer claim a coach watched", () => {
    expect(read("app/(player)/you/page.tsx")).toContain("<TimeByArea");
    for (const f of ["app/(player)/progress/page.tsx", "components/elite/ProgressPanel.tsx", "app/(player)/you/page.tsx"]) {
      const src = read(f);
      expect(src).not.toMatch(/Your coach rates|Coach&apos;s rating<|coach's rating, your goals/);
      expect(src).not.toMatch(/\bAI\b|automated|algorithm/);
    }
  });
});
