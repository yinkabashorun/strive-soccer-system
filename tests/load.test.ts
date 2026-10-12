import { describe, expect, it } from "vitest";
import {
  composeExtraSession,
  conformSessionsToBank,
  drillFitsPlayer,
  EXTRA_SKILL_DRILLS,
} from "@/lib/elite/bank-conform";
import { methodologyContext } from "@/lib/elite/methodology";
import { sessionsFor, sessionsWord, TRAINING_LOADS } from "@/lib/elite/training";
import type { Drill, GeneratedSession } from "@/lib/elite/types";

// Offer stack item 1 (Oct 12 2026): training load plans, the tight-space
// setting, and Extra Work. The first rule of this build: every default
// reproduces today's week exactly, so existing players are untouched.
function drill(partial: Partial<Drill> & { title: string; pillar: string }): Drill {
  return {
    id: partial.title.toLowerCase().replace(/\W+/g, "-"),
    how: `How to do ${partial.title}`,
    reps: "3 x 10",
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
  drill({ title: "Figure-8 dribble", pillar: "Ball Mastery", small_space: true }),
  drill({ title: "Inside-outside cone weave", pillar: "Ball Mastery" }),
  drill({ title: "8-cone freestyle", pillar: "Ball Mastery" }),
  drill({ title: "Ronaldinho drill", pillar: "Ball Mastery", small_space: true }),
  drill({ title: "Neymar Feint", pillar: "Confidence", small_space: true }),
  drill({ title: "Maradona", pillar: "Confidence", small_space: true }),
  drill({ title: "Elastico", pillar: "Confidence" }),
  drill({ title: "Two touch passing", pillar: "Passing", needs_wall: true }),
  drill({ title: "Wall pass, touch, scissor", pillar: "Weak Foot", needs_wall: true }),
  drill({ title: "Plyo warm-up: Pogo jumps", pillar: "Plyo" }),
  drill({ title: "Plyo warm-up: Squat jumps", pillar: "Plyo" }),
];

describe("training load", () => {
  it("defaults to the four-session In-Season week for every pre-033 player", () => {
    expect(sessionsFor(undefined)).toBe(4);
    expect(sessionsFor(null)).toBe(4);
    expect(sessionsFor("in_season")).toBe(4);
    expect(sessionsFor("off_season")).toBe(6);
    expect(TRAINING_LOADS.off_season.sessions).toBe(6);
    expect(sessionsWord(4)).toBe("four");
    expect(sessionsWord(6)).toBe("six");
  });
  it("the prompt states the player's session count", () => {
    expect(methodologyContext(bank)).toContain("- 4 sessions that week");
    expect(methodologyContext(bank, { sessionsPerWeek: 6 })).toContain("- 6 sessions that week");
    expect(methodologyContext(bank)).toContain("Figure-8 dribble [small space]");
  });
});

describe("space setting", () => {
  it("open space (the default) filters nothing but the wall rule", () => {
    const d = bank.find((b) => b.title === "8-cone freestyle")!;
    expect(drillFitsPlayer(d, null)).toBe(true);
    expect(drillFitsPlayer(d, { space: "open" })).toBe(true);
    expect(drillFitsPlayer(d, undefined)).toBe(true);
    expect(drillFitsPlayer(bank.find((b) => b.needs_wall)!, { has_wall: false })).toBe(false);
  });
  it("tight space only ever assigns small_space skill drills; plyos still fit", () => {
    const week: GeneratedSession[] = [
      { title: "S1", drills: [{ title: "8-cone freestyle", exercise: "x", reps: "x" }, { title: "Elastico", exercise: "x", reps: "x" }] },
      { title: "S2", drills: [] },
    ];
    const out = conformSessionsToBank(week, bank, { has_wall: true, space: "tight" }, "");
    const small = new Set(bank.filter((b) => b.small_space).map((b) => b.title));
    for (const s of out) {
      for (const d of s.drills) {
        if (/^plyo/i.test(d.title)) continue;
        expect(small.has(d.title)).toBe(true);
      }
    }
    expect(drillFitsPlayer(bank.find((b) => b.pillar === "Plyo")!, { space: "tight" })).toBe(true);
  });
});

describe("Extra Work", () => {
  const weekTitles = ["Figure-8 dribble", "Neymar Feint", "Plyo warm-up: Pogo jumps"];
  it("is a structured session: one warm-up, then three shelf drills the player has never done", () => {
    const s = composeExtraSession({
      bank,
      player: { has_wall: true, space: "open" },
      shelf: "ball_mastery",
      doneTitles: ["Inside-outside cone weave"],
      weekTitles,
    })!;
    expect(s).toBeTruthy();
    expect(s.drills[0].title).toBe("Plyo warm-up: Squat jumps"); // not this week's plyo
    const skills = s.drills.slice(1);
    expect(skills).toHaveLength(EXTRA_SKILL_DRILLS);
    // never-done, not-this-week Ball Mastery first (8-cone, Ronaldinho),
    // then this week's Figure-8 (assigned, not done yet). The done cone
    // weave is never picked while anything undone exists.
    expect(skills.map((d) => d.title)).toEqual(["8-cone freestyle", "Ronaldinho drill", "Figure-8 dribble"]);
    expect(skills.map((d) => d.title)).not.toContain("Inside-outside cone weave");
  });
  it("prefers never-done drills over this week's and this week's over already-done", () => {
    const s = composeExtraSession({
      bank,
      player: { has_wall: false, space: "open" },
      shelf: "one_v_one",
      doneTitles: ["Elastico"],
      weekTitles: ["Maradona"],
    })!;
    const skills = s.drills.filter((d) => !/^plyo/i.test(d.title)).map((d) => d.title);
    expect(skills[0]).toBe("Neymar Feint"); // never done, not this week
    expect(skills[1]).toBe("Maradona"); // this week, not done yet
    // the shelf is out of undone drills: topped up from Ball Mastery, never
    // the already-done Elastico
    expect(skills).not.toContain("Elastico");
    expect(skills).toHaveLength(EXTRA_SKILL_DRILLS);
  });
  it("repeats only when the player has done every drill they can do", () => {
    const all = bank.filter((b) => b.pillar !== "Plyo").map((b) => b.title);
    const s = composeExtraSession({ bank, player: { has_wall: true }, shelf: "one_v_one", doneTitles: all, weekTitles: [] })!;
    const skills = s.drills.filter((d) => !/^plyo/i.test(d.title));
    expect(skills).toHaveLength(EXTRA_SKILL_DRILLS);
    for (const d of skills) expect(bank.find((b) => b.title === d.title)?.pillar).toBe("Confidence");
  });
  it("Wall Work needs a wall, and every shelf respects tight space", () => {
    expect(
      composeExtraSession({ bank, player: { has_wall: false }, shelf: "wall_work", doneTitles: [], weekTitles: [] })
    ).toBeNull();
    const w = composeExtraSession({ bank, player: { has_wall: true }, shelf: "wall_work", doneTitles: [], weekTitles: [] })!;
    expect(w.drills.filter((d) => !/^plyo/i.test(d.title)).map((d) => d.title)).toEqual(
      expect.arrayContaining(["Two touch passing", "Wall pass, touch, scissor"])
    );
    const t = composeExtraSession({ bank, player: { space: "tight" }, shelf: "ball_mastery", doneTitles: [], weekTitles: [] })!;
    for (const d of t.drills) {
      if (/^plyo/i.test(d.title)) continue;
      expect(bank.find((b) => b.title === d.title)?.small_space).toBe(true);
    }
  });
  it("every extra drill is a filmed bank drill (so the 031 guard always passes)", () => {
    const s = composeExtraSession({ bank, player: null, shelf: "ball_mastery", doneTitles: [], weekTitles: [] })!;
    for (const d of s.drills) expect(bank.some((b) => b.title === d.title && b.video_url)).toBe(true);
  });
});
