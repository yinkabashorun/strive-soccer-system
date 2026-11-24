import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ACHIEVEMENT_RULES,
  MARK_MAX,
  achievementMark,
  fullWeeks,
  newlyEarned,
  presentAchievement,
  presentAchievements,
} from "@/lib/elite/achievement-rules";
import { DEMO_ACHIEVEMENTS } from "@/lib/elite/demo";
import type { Homework, PlayerSummary } from "@/lib/elite/types";
import { memberFiles, rel } from "./helpers/member-files";

// Coach Yinka's rule (Oct 12 2026): a break never costs. So no badge may
// ask for days or weeks back to back, and none may be worded as a streak
// or a percentage. And a badge already earned is never taken away.

const summary = (over: Partial<PlayerSummary> = {}): PlayerSummary => ({
  current_streak: 0,
  sessions_completed: 0,
  homework_total: 0,
  homework_completed: 0,
  homework_pct: 0,
  training_minutes: 0,
  last_active: null,
  ...over,
});

// A player's homework where the listed weeks are fully done and the
// others are half done.
function weeks(full: number[], partial: number[] = []): Homework[] {
  const rows: Partial<Homework>[] = [];
  for (const w of full) for (let i = 0; i < 4; i++) rows.push({ week: w, completed: true });
  for (const w of partial) for (let i = 0; i < 4; i++) rows.push({ week: w, completed: i < 2 });
  return rows as Homework[];
}

// The rule this badge had until Nov 18 2026: three full weeks back to back.
function oldThreePerfectWeeks(hw: Homework[]): boolean {
  const w = fullWeeks(hw);
  let chain = 1;
  for (let i = 1; i < w.length; i++) {
    chain = w[i] === w[i - 1] + 1 ? chain + 1 : 1;
    if (chain >= 3) return true;
  }
  return false;
}

const rule = (title: string) => ACHIEVEMENT_RULES.find((r) => r.title === title)!;

describe("badges: nothing a break can take away", () => {
  it("no badge is worded as a streak, a run or a percentage", () => {
    for (const r of ACHIEVEMENT_RULES) {
      const words = `${r.title} ${r.detail}`;
      expect(words, r.title).not.toMatch(/streak|straight|in a row|back to back|perfect|percent|%|\d+\s*days?\b/i);
      expect(words, r.title).not.toMatch(/—|\bAI\b|automated|algorithm/);
    }
  });

  it("three full weeks counts any three, with a gap or a break between them", () => {
    const three = rule("3 Full Weeks");
    expect(three.earned(weeks([1, 2, 3]), summary())).toBe(true);
    expect(three.earned(weeks([1, 4, 9]), summary())).toBe(true);
    expect(three.earned(weeks([2, 5, 6], [1, 3, 4]), summary())).toBe(true);
    expect(three.earned(weeks([1, 2], [3]), summary())).toBe(false);
    expect(three.earned(weeks([], [1, 2, 3]), summary())).toBe(false);
  });

  it("covers everyone the old back-to-back rule covered, so no badge is lost", () => {
    const three = rule("3 Full Weeks");
    // Every pattern of full and partial weeks across eight weeks.
    for (let mask = 0; mask < 256; mask++) {
      const full: number[] = [];
      const partial: number[] = [];
      for (let w = 1; w <= 8; w++) (mask & (1 << (w - 1)) ? full : partial).push(w);
      const hw = weeks(full, partial);
      if (oldThreePerfectWeeks(hw)) expect(three.earned(hw, summary()), `mask ${mask}`).toBe(true);
    }
  });

  it("a member who holds the badge under its old name is not handed it again", () => {
    const hw = weeks([1, 2, 3]);
    const s = summary({ sessions_completed: 12, training_minutes: 300 });
    const fresh = newlyEarned(hw, s, ["First Session", "Week Conquered", "3 Perfect Weeks"]).map((r) => r.title);
    expect(fresh).toEqual(["10 Sessions"]);
    expect(newlyEarned(hw, s, []).map((r) => r.title)).toContain("3 Full Weeks");
  });

  it("an old badge is shown in today's words and never disappears", () => {
    expect(presentAchievement({ title: "3 Perfect Weeks", detail: "Three straight weeks at 100%" })).toEqual({
      title: "3 Full Weeks",
      detail: "Three weeks with every drill done",
    });
    const old = presentAchievement({ title: "7-Day Streak", detail: "Trained seven days in a row" });
    expect(`${old.title} ${old.detail}`).not.toMatch(/streak|in a row|straight/i);
    const untouched = { title: "Week Conquered", detail: "Every drill in a week, done" };
    expect(presentAchievement(untouched)).toEqual(untouched);

    const shown = presentAchievements([
      { title: "3 Perfect Weeks", detail: "Three straight weeks at 100%", earned_at: "2026-10-01" },
      { title: "3 Full Weeks", detail: "Three weeks with every drill done", earned_at: "2026-11-20" },
      { title: "7-Day Streak", detail: "Trained seven days in a row", earned_at: "2026-09-20" },
    ]);
    expect(shown.map((a) => a.title)).toEqual(["3 Full Weeks", "7 Days Trained"]);
    expect(shown[0].earned_at).toBe("2026-10-01");
  });

  it("the example players only hold badges the engine awards today", () => {
    for (const a of DEMO_ACHIEVEMENTS) {
      const r = ACHIEVEMENT_RULES.find((x) => x.title === a.title);
      expect(r, a.title).toBeTruthy();
      expect(a.detail).toBe(r!.detail);
    }
  });
});

describe("no streak wording on any member-facing screen", () => {
  it("holds across every page a member can reach", () => {
    for (const f of memberFiles()) {
      const copy = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(copy, rel(f)).not.toMatch(/streak|leaderboard|perfect weeks?|weeks? at 100|in a row/i);
    }
  });
});

// The iPhone app shows each badge as a gold medal with a short engraving,
// the way the hours medals read "1H" (Nov 24 2026, Coach Yinka on the grey
// tile it was: "doesn't look like an achievement").
describe("the engraving on a badge", () => {
  it("every badge has one, short enough for the medal, and no two share it", () => {
    const marks = ACHIEVEMENT_RULES.map((r) => r.mark);
    for (const m of marks) {
      expect(m.length).toBeGreaterThan(0);
      expect(m.length).toBeLessThanOrEqual(MARK_MAX);
      expect(m).toBe(m.toUpperCase());
      expect(m).not.toMatch(/%|streak/i);
    }
    expect(new Set(marks).size).toBe(marks.length);
  });
  it("is found by the title the member reads, old wording included", () => {
    for (const r of ACHIEVEMENT_RULES) {
      expect(achievementMark(r.title)).toBe(r.mark);
      for (const was of r.formerly ?? []) expect(achievementMark(was)).toBe(r.mark);
    }
    expect(achievementMark("7-Day Streak")).toBe("7D");
    expect(achievementMark(presentAchievement({ title: "7-Day Streak", detail: "" }).title)).toBe("7D");
  });
  it("makes nothing up for a title no rule knows", () => {
    expect(achievementMark("Something else")).toBeNull();
  });
});
