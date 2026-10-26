import { describe, expect, it } from "vitest";
import { conformSessionsToBank, drillFitsPlayer, isSkillPillar } from "@/lib/elite/bank-conform";
import { methodologyContext } from "@/lib/elite/methodology";
import { SHOOTING_PILLAR } from "@/lib/elite/types";
import type { Drill, GeneratedSession } from "@/lib/elite/types";

// The Shooting pillar and the goal rule (042, Oct 26 2026): a drill that
// needs a goal fits only a player whose profile says they have one, the
// same way a wall drill needs a wall. Shooting is a skill pillar, not a
// rated metric.
function drill(partial: Partial<Drill> & { title: string; pillar: string }): Drill {
  return {
    id: partial.title.toLowerCase().replace(/\W+/g, "-"),
    how: `How to do ${partial.title}`,
    reps: "3 x 8",
    minutes: 8,
    cues: "",
    needs_wall: false,
    active: true,
    video_url: `https://videos.example/${partial.title}`,
    sort: 0,
    ...partial,
  } as Drill;
}

const goalDrill = drill({ title: "Far post finish", pillar: SHOOTING_PILLAR, needs_goal: true });
const coneDrill = drill({ title: "Strike at a cone", pillar: SHOOTING_PILLAR });
const bank: Drill[] = [
  goalDrill,
  coneDrill,
  drill({ title: "Maradona", pillar: "Confidence" }),
  drill({ title: "Elastico", pillar: "Confidence" }),
  drill({ title: "Figure-8 dribble", pillar: "Ball Mastery" }),
  drill({ title: "Plyo warm-up: Pogo jumps", pillar: "Plyo" }),
];

describe("the goal rule", () => {
  it("a goal drill fits only a player with a goal; unknown counts as no goal", () => {
    expect(drillFitsPlayer(goalDrill, null)).toBe(false);
    expect(drillFitsPlayer(goalDrill, { has_goal: null })).toBe(false);
    expect(drillFitsPlayer(goalDrill, { has_goal: false })).toBe(false);
    expect(drillFitsPlayer(goalDrill, { has_goal: true })).toBe(true);
  });
  it("a shooting drill at a cone fits everyone", () => {
    expect(drillFitsPlayer(coneDrill, null)).toBe(true);
    expect(drillFitsPlayer(coneDrill, { has_goal: false })).toBe(true);
  });
  it("Shooting is a skill pillar", () => {
    expect(isSkillPillar(SHOOTING_PILLAR)).toBe(true);
  });
});

describe("the prompt", () => {
  it("lists shooting drills under their own pillar and marks the ones that need a goal", () => {
    const ctx = methodologyContext(bank);
    expect(ctx).toContain("- Shooting:");
    expect(ctx).toContain("Far post finish [goal]");
    expect(ctx).not.toContain("Strike at a cone [goal]");
    expect(ctx).toContain('drills marked "goal" ONLY for players who HAVE a goal');
  });
});

describe("the gates", () => {
  const plan: GeneratedSession[] = [
    {
      title: "Session 1",
      drills: [
        { title: "Far post finish", exercise: "x", reps: "x" },
        { title: "Maradona", exercise: "x", reps: "x" },
        { title: "Figure-8 dribble", exercise: "x", reps: "x" },
      ],
    },
  ];
  it("a goal drill written for a player with no goal is replaced; a player with a goal keeps it", () => {
    const noGoal = conformSessionsToBank(plan, bank, { has_wall: false, has_goal: false }, "Focus.", "optional");
    expect(noGoal[0].drills.map((d) => d.title)).not.toContain("Far post finish");
    expect(noGoal[0].drills.filter((d) => !/^Plyo/.test(d.title))).toHaveLength(3);
    const withGoal = conformSessionsToBank(plan, bank, { has_wall: false, has_goal: true }, "Focus.", "optional");
    expect(withGoal[0].drills.map((d) => d.title)).toContain("Far post finish");
  });
});
