import { describe, expect, it } from "vitest";
import {
  conformSessionsToBank,
  isSkillPillar,
  isStrengthTitle,
  strengthRequired,
} from "@/lib/elite/bank-conform";
import { EmptyBankError, methodologyContext } from "@/lib/elite/methodology";
import { STRENGTH_PILLAR } from "@/lib/elite/types";
import type { Drill, GeneratedSession } from "@/lib/elite/types";

// The Strengthening pillar (Oct 7 2026, Coach Yinka: "make a strengthening
// pillar"): core / hip / prevention finishers from the filmed bank, always
// the last drill of a session, at most one, required in every session when
// the player's notes call for it, never counted as a skill drill.
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

const bank: Drill[] = [
  drill({ title: "Maradona", pillar: "Confidence" }),
  drill({ title: "Elastico", pillar: "Confidence" }),
  drill({ title: "Figure-8 dribble", pillar: "Ball Mastery" }),
  drill({ title: "Wall juggles", pillar: "Ball Mastery" }),
  drill({ title: "Plyo warm-up: Pogo jumps", pillar: "Plyo" }),
  drill({ title: "Strength: Core A", pillar: STRENGTH_PILLAR }),
  drill({ title: "Strength: Hips", pillar: STRENGTH_PILLAR }),
];
const strengthTitles = new Set(["Strength: Core A", "Strength: Hips"]);

const week: GeneratedSession[] = [
  { title: "S1", drills: [{ title: "Maradona", exercise: "x", reps: "x" }] },
  {
    title: "S2",
    // the AI put the finisher FIRST and twice; it must end up last, once
    drills: [
      { title: "Strength: Hips", exercise: "x", reps: "x" },
      { title: "Strength: Core A", exercise: "x", reps: "x" },
      { title: "Elastico", exercise: "x", reps: "x" },
    ],
  },
  { title: "S3", drills: [] },
  { title: "S4", drills: [{ title: "Figure-8 dribble", exercise: "x", reps: "x" }] },
];

describe("strengthening finishers", () => {
  it("required mode: exactly one filmed finisher ends EVERY session, after three skill drills", () => {
    const out = conformSessionsToBank(week, bank, null, "", "required");
    expect(out).toHaveLength(4);
    for (const s of out) {
      const finishers = s.drills.filter((d) => strengthTitles.has(d.title));
      expect(finishers).toHaveLength(1);
      expect(strengthTitles.has(s.drills[s.drills.length - 1].title)).toBe(true);
      const skills = s.drills.filter((d) => !strengthTitles.has(d.title) && !/^plyo/i.test(d.title));
      expect(skills).toHaveLength(3);
      for (const d of s.drills) expect(bank.some((b) => b.title === d.title)).toBe(true);
    }
  });
  it("optional mode: keeps what the AI placed (capped at one, moved last), adds none elsewhere", () => {
    const out = conformSessionsToBank(week, bank, null, "", "optional");
    expect(out[1].drills.filter((d) => strengthTitles.has(d.title))).toHaveLength(1);
    expect(strengthTitles.has(out[1].drills[out[1].drills.length - 1].title)).toBe(true);
    for (const i of [0, 2, 3]) {
      expect(out[i].drills.some((d) => strengthTitles.has(d.title))).toBe(false);
    }
  });
  it("default mode is optional", () => {
    const out = conformSessionsToBank(week, bank, null, "");
    expect(out[0].drills.some((d) => strengthTitles.has(d.title))).toBe(false);
  });
  it("no filmed finishers in the bank: none placed, even in required mode, and the AI's are dropped", () => {
    const noStrength = bank.filter((d) => d.pillar !== STRENGTH_PILLAR);
    const out = conformSessionsToBank(week, noStrength, null, "", "required");
    for (const s of out) {
      expect(s.drills.some((d) => isStrengthTitle(d.title))).toBe(false);
      expect(s.drills.filter((d) => !/^plyo/i.test(d.title))).toHaveLength(3);
    }
  });
  it("a strengthening drill never fills a skill slot", () => {
    const strengthOnly = bank.filter((d) => d.pillar === STRENGTH_PILLAR);
    // no skill drills at all: the plan is left alone (same as an empty bank)
    expect(conformSessionsToBank(week, strengthOnly, null, "", "required")).toEqual(week);
    expect(isSkillPillar(STRENGTH_PILLAR)).toBe(false);
    expect(isSkillPillar("Plyo")).toBe(false);
    expect(isSkillPillar("Ball Mastery")).toBe(true);
  });
});

describe("strengthRequired", () => {
  it("fires on an injury / core / hip / strength note", () => {
    expect(strengthRequired("lower back, ~50%, no plyos until cleared, add core and injury-prevention")).toBe(true);
    expect(strengthRequired("Tight hip flexors, keep him moving")).toBe(true);
    expect(strengthRequired("coming back from a hamstring strain")).toBe(true);
    expect(strengthRequired("wants more strength work")).toBe(true);
  });
  it("stays quiet on ordinary notes", () => {
    expect(strengthRequired("Great week, back on track, 4/4 sessions. Push the weak foot.")).toBe(false);
    expect(strengthRequired("Known strengths: first touch. Build the Maradona under pressure.")).toBe(false);
    expect(strengthRequired("")).toBe(false);
    expect(strengthRequired(null)).toBe(false);
  });
});

describe("methodology prompt and the Strengthening pillar", () => {
  it("lists finishers in their own block, never as a skill pillar", () => {
    const ctx = methodologyContext(bank);
    expect(ctx).toContain("STRENGTHENING FINISHERS");
    expect(ctx).toContain("Strength: Core A");
    expect(ctx).not.toMatch(/- Strengthening:/);
    expect(ctx).not.toContain("Pogo");
  });
  it("says so when the bank has no finishers yet, and never invents one", () => {
    const ctx = methodologyContext(bank.filter((d) => d.pillar !== STRENGTH_PILLAR));
    expect(ctx).toContain("no strengthening finishers yet");
    expect(ctx).toMatch(/Do not\s+invent one/);
  });
  it("a bank of only plyos and finishers still refuses to build", () => {
    const noSkills = bank.filter((d) => d.pillar === "Plyo" || d.pillar === STRENGTH_PILLAR);
    expect(() => methodologyContext(noSkills)).toThrow(EmptyBankError);
  });
});
