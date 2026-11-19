import { describe, expect, it } from "vitest";
import { conformSessionsToBank, focusCounts, offeredBank, orderFocusPool } from "@/lib/elite/bank-conform";
import {
  cleanFocuses,
  cleanThreads,
  draftFocuses,
  FOCUS_PILLAR_KEYS,
  programWeekFor,
  type Program,
  type ProgramWeek,
} from "@/lib/elite/program";
import type { Drill, GeneratedSession } from "@/lib/elite/types";

// The 3-month program (065, Coach Yinka, Nov 11 2026): three monthly
// blocks, two focuses per block, the focus gets two of each session's
// three skill drills ("Me, two of 3"), the third keeps the rest alive,
// threads never take a skill-drill slot, harder drills lead the second
// week of a focus. A player with no program builds exactly as before.
function drill(partial: Partial<Drill> & { title: string; pillar: string }): Drill {
  return {
    id: partial.title.toLowerCase().replace(/\W+/g, "-"),
    how: `How to do ${partial.title}`,
    reps: "3 x 10",
    minutes: 5,
    cues: "",
    needs_wall: false,
    active: true,
    video_url: `https://videos.example/${partial.title}`,
    sort: 0,
    ...partial,
  } as Drill;
}

const bank: Drill[] = [
  drill({ title: "Weak foot tap, pull, push", pillar: "Weak Foot", focus_pillar: "weak_foot", level: 1, sort: 100 }),
  drill({ title: "Weak foot outside pull, inside pull", pillar: "Weak Foot", focus_pillar: "weak_foot", level: 2, sort: 110 }),
  drill({ title: "Wall pass, touch behind the leg", pillar: "Weak Foot", focus_pillar: "weak_foot", level: 3, sort: 300, needs_wall: true }),
  drill({ title: "Weak foot pop and juggle", pillar: "Weak Foot", focus_pillar: "weak_foot", level: 2, sort: 130 }),
  drill({ title: "Figure-8 dribble", pillar: "Ball Mastery", focus_pillar: "close_control", level: 1 }),
  drill({ title: "2 touch ball mastery variation 1", pillar: "Ball Mastery", focus_pillar: "first_touch_ground", level: 1 }),
  drill({ title: "Neymar Feint", pillar: "Confidence", focus_pillar: "one_v_one", level: 1 }),
  drill({ title: "Elastico", pillar: "Confidence", focus_pillar: "one_v_one", level: 3 }),
  drill({ title: "Two touch passing", pillar: "Passing", focus_pillar: "passing_short", level: 1, needs_wall: true }),
  drill({ title: "Plyo warm-up: Pogo jumps", pillar: "Plyo" }),
  drill({ title: "Strength: Front plank", pillar: "Strengthening" }),
  drill({ title: "Strength: Bird dog", pillar: "Strengthening" }),
  drill({ title: "Juggling: one touch, catch", pillar: "Ball Mastery", opt_in: true, focus_pillar: "first_touch_air", level: 1, sort: 300 }),
  drill({ title: "Juggling: head it up", pillar: "Ball Mastery", opt_in: true, focus_pillar: "first_touch_air", level: 3, sort: 410 }),
  drill({ title: "Speed: Kneel and drive", pillar: "Speed", opt_in: true, focus_pillar: "acceleration", level: 1, sort: 120 }),
  drill({ title: "Speed: 15 yard sprint", pillar: "Speed", opt_in: true, focus_pillar: "acceleration", level: 2, sort: 160 }),
];

const withWall = { has_wall: true, space: "open" as const };
const noWall = { has_wall: false, space: "open" as const };
const empty = (n: number): GeneratedSession[] => Array.from({ length: n }, (_, i) => ({ title: `Session ${i + 1}`, drills: [] }));

const program: Program = {
  id: "p1",
  player_id: "x",
  start_week: 5,
  weeks: 12,
  status: "active",
  focuses: ["weak_foot", "first_touch_air", "passing_short", "one_v_one", "acceleration", "close_control"],
  threads: [
    { kind: "strength", from_block: 1, to_block: 3 },
    { kind: "speed", from_block: 3, to_block: 3 },
  ],
  quiz: {},
};

const week = (over: Partial<ProgramWeek> = {}): ProgramWeek => ({
  index: 0,
  block: 1,
  half: 1,
  weekInHalf: 1,
  focus: "weak_foot",
  focusName: "Weak foot",
  strength: false,
  speed: false,
  ...over,
});

const pillarOf = (title: string) => bank.find((d) => d.title === title)?.focus_pillar ?? null;
const isSkill = (title: string) => !/^(plyo|strength)/i.test(title) && !/^speed:/i.test(title);

describe("programWeekFor", () => {
  it("is null before the program starts and after it ends", () => {
    expect(programWeekFor(program, 4)).toBeNull();
    expect(programWeekFor(program, 17)).toBeNull();
    expect(programWeekFor(null, 5)).toBeNull();
    expect(programWeekFor({ ...program, status: "ended" }, 5)).toBeNull();
  });
  it("gives each focus two weeks, two focuses a month", () => {
    const focusByWeek = Array.from({ length: 12 }, (_, i) => programWeekFor(program, 5 + i)!.focus);
    expect(focusByWeek).toEqual([
      "weak_foot", "weak_foot", "first_touch_air", "first_touch_air",
      "passing_short", "passing_short", "one_v_one", "one_v_one",
      "acceleration", "acceleration", "close_control", "close_control",
    ]);
    expect(programWeekFor(program, 5)).toMatchObject({ block: 1, half: 1, weekInHalf: 1 });
    expect(programWeekFor(program, 6)).toMatchObject({ block: 1, half: 1, weekInHalf: 2 });
    expect(programWeekFor(program, 8)).toMatchObject({ block: 1, half: 2, weekInHalf: 2 });
    expect(programWeekFor(program, 16)).toMatchObject({ block: 3, half: 2, weekInHalf: 2 });
  });
  it("switches threads on only for their months", () => {
    expect(programWeekFor(program, 5)).toMatchObject({ strength: true, speed: false });
    expect(programWeekFor(program, 12)).toMatchObject({ strength: true, speed: false });
    expect(programWeekFor(program, 13)).toMatchObject({ strength: true, speed: true });
  });
});

describe("the focus gets two of the three skill drills", () => {
  it("places two focus drills and one from another area in every session", () => {
    const out = conformSessionsToBank(empty(4), bank, withWall, "", "optional", null, week());
    for (const s of out) {
      const skills = s.drills.map((d) => d.title).filter(isSkill);
      expect(skills).toHaveLength(3);
      expect(skills.filter((t) => pillarOf(t) === "weak_foot")).toHaveLength(2);
      expect(skills.filter((t) => pillarOf(t) !== "weak_foot")).toHaveLength(1);
    }
  });
  it("rotates the third drill through the other areas across the week", () => {
    const out = conformSessionsToBank(empty(4), bank, withWall, "", "optional", null, week());
    const thirds = out.map((s) => s.drills.map((d) => d.title).filter(isSkill).find((t) => pillarOf(t) !== "weak_foot")!);
    expect(new Set(thirds).size).toBeGreaterThan(1);
  });
  it("keeps the wall rule inside a focus", () => {
    const out = conformSessionsToBank(empty(4), bank, noWall, "", "optional", null, week());
    const titles = out.flatMap((s) => s.drills.map((d) => d.title));
    expect(titles).not.toContain("Wall pass, touch behind the leg");
    expect(titles).not.toContain("Two touch passing");
  });
  it("leads with easier drills in week one of a focus and harder ones in week two", () => {
    const pool = bank.filter((d) => d.focus_pillar === "weak_foot");
    expect(orderFocusPool(pool, 1)[0].title).toBe("Weak foot tap, pull, push");
    expect(orderFocusPool(pool, 2)[0].title).toBe("Wall pass, touch behind the leg");
    const second = conformSessionsToBank(empty(1), bank, withWall, "", "optional", null, week({ weekInHalf: 2 }));
    expect(second[0].drills.map((d) => d.title)).toContain("Wall pass, touch behind the leg");
  });
  it("brings course drills of the focus pillar into the week without a tick", () => {
    const w = week({ focus: "first_touch_air", focusName: "First touch out of the air" });
    const out = conformSessionsToBank(empty(2), offeredBank(bank, withWall, w), withWall, "", "optional", null, w);
    for (const s of out) {
      expect(s.drills.filter((d) => /^juggling:/i.test(d.title))).toHaveLength(2);
    }
    // and never for a player whose week has a different focus
    const other = conformSessionsToBank(empty(2), offeredBank(bank, withWall, week()), withWall, "", "optional", null, week());
    expect(other.flatMap((s) => s.drills).some((d) => /^juggling:/i.test(d.title))).toBe(false);
  });
  it("keeps the plan's own drill from another area as the third", () => {
    const sessions: GeneratedSession[] = [
      { title: "Day 1", drills: [{ title: "Elastico", exercise: "x", reps: "3 x 5", minutes: 6 }] },
    ];
    const out = conformSessionsToBank(sessions, bank, withWall, "", "optional", null, week());
    const skills = out[0].drills.map((d) => d.title).filter(isSkill);
    expect(skills).toContain("Elastico");
    expect(skills.filter((t) => pillarOf(t) === "weak_foot")).toHaveLength(2);
  });
});

describe("threads never take a skill-drill slot", () => {
  it("the strength thread ends every session with a finisher", () => {
    const out = conformSessionsToBank(empty(4), bank, withWall, "", "optional", null, week({ strength: true }));
    for (const s of out) {
      expect(s.drills[s.drills.length - 1].title).toMatch(/^Strength:/);
      expect(s.drills.map((d) => d.title).filter(isSkill)).toHaveLength(3);
    }
  });
  it("the speed thread fills the slot after the warm-up", () => {
    const w = week({ speed: true });
    const sessions: GeneratedSession[] = [
      { title: "Day 1", drills: [{ title: "Plyo warm-up: Pogo jumps", exercise: "x", reps: "3 x 15", minutes: 4 }] },
    ];
    const out = conformSessionsToBank(sessions, offeredBank(bank, withWall, w), withWall, "", "optional", null, w);
    const titles = out[0].drills.map((d) => d.title);
    expect(titles[0]).toBe("Plyo warm-up: Pogo jumps");
    expect(titles[1]).toMatch(/^Speed:/);
    expect(titles.filter(isSkill)).toHaveLength(3);
  });
  it("speed drills stay out of the week when no thread or focus names them", () => {
    const out = conformSessionsToBank(empty(4), offeredBank(bank, withWall, week()), withWall, "", "optional", null, week());
    expect(out.flatMap((s) => s.drills).some((d) => /^speed:/i.test(d.title))).toBe(false);
  });
});

describe("no program, nothing changes", () => {
  it("builds the same week with and without a null program", () => {
    const sessions: GeneratedSession[] = [
      { title: "Day 1", drills: [{ title: "Neymar Feint", exercise: "x", reps: "3 x 5", minutes: 6 }] },
      { title: "Day 2", drills: [] },
    ];
    const a = conformSessionsToBank(sessions, offeredBank(bank, withWall), withWall, "", "optional", null);
    const b = conformSessionsToBank(sessions, offeredBank(bank, withWall, null), withWall, "", "optional", null, null);
    expect(b).toEqual(a);
  });
  it("a focus with no drills the player can do falls back to the ordinary week", () => {
    const w = week({ focus: "passing_short", focusName: "Short and combination passing" });
    const out = conformSessionsToBank(empty(2), bank, noWall, "", "optional", null, w);
    for (const s of out) expect(s.drills.map((d) => d.title).filter(isSkill)).toHaveLength(3);
  });
});

describe("the quiz draft and its guards", () => {
  const all = FOCUS_PILLAR_KEYS;
  it("ranks the limiters across the six half-months", () => {
    expect(draftFocuses(["weak_foot", "one_v_one", "passing_short"], true, all)).toEqual([
      "weak_foot", "one_v_one", "passing_short", "weak_foot", "one_v_one", "passing_short",
    ]);
  });
  it("holds speed to the last month for a player not cleared to run", () => {
    const d = draftFocuses(["acceleration", "weak_foot", "one_v_one"], false, all);
    expect(d.slice(0, 4).some((k) => ["acceleration", "top_speed", "speed_technique", "explosiveness"].includes(k))).toBe(false);
    expect(d).toHaveLength(6);
  });
  it("never drafts a pillar with no drills for this player", () => {
    expect(draftFocuses(["passing_air", "weak_foot"], true, ["weak_foot"])).toEqual(Array(6).fill("weak_foot"));
  });
  it("refuses anything but six real pillars and a clean thread span", () => {
    expect(cleanFocuses(["weak_foot"])).toBeNull();
    expect(cleanFocuses(["weak_foot", "one_v_one", "weak_foot", "one_v_one", "weak_foot", "shooting"])).toBeNull();
    expect(cleanThreads([{ kind: "strength", from_block: 2, to_block: 1 }, { kind: "speed", from_block: 3, to_block: 3 }, { kind: "runs", from_block: 1, to_block: 3 }])).toEqual([
      { kind: "speed", from_block: 3, to_block: 3 },
    ]);
  });
  it("counts the drills a player can do per focus, wall rule applied", () => {
    expect(focusCounts(bank, withWall).weak_foot).toBe(4);
    expect(focusCounts(bank, noWall).weak_foot).toBe(3);
    expect(focusCounts(bank, noWall).passing_short).toBeUndefined();
    expect(focusCounts(bank, noWall).first_touch_air).toBe(2);
  });
});
