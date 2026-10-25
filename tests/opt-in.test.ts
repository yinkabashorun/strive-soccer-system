import { describe, expect, it } from "vitest";
import {
  composeExtraSession,
  conformSessionsToBank,
  drillFitsPlayer,
  isOffered,
  isSkillTitle,
  offeredBank,
  skillBank,
  templateSessions,
} from "@/lib/elite/bank-conform";
import { methodologyContext } from "@/lib/elite/methodology";
import type { Drill, GeneratedSession } from "@/lib/elite/types";

// Course drills offered per player (040, Oct 23 2026). Coach Yinka: "Just
// make it an option for me to toggle to offer juggling drills then select
// the ones you can choose from for the player." The rule: an opt-in drill
// does not exist for a player unless the coach switched them on AND ticked
// that drill. Every default reproduces today's week exactly.
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

const juggleCatch = drill({ title: "Juggling: one touch, catch", pillar: "Ball Mastery", opt_in: true, small_space: true, sort: 300 });
const juggleKeep = drill({ title: "Juggling: one touch, keep it up", pillar: "Ball Mastery", opt_in: true, small_space: true, sort: 305 });
const bank: Drill[] = [
  drill({ title: "Figure-8 dribble", pillar: "Ball Mastery", small_space: true }),
  drill({ title: "Inside-outside cone weave", pillar: "Ball Mastery" }),
  drill({ title: "Ronaldinho drill", pillar: "Ball Mastery", small_space: true }),
  drill({ title: "Neymar Feint", pillar: "Confidence", small_space: true }),
  drill({ title: "Maradona", pillar: "Confidence", small_space: true }),
  drill({ title: "Elastico", pillar: "Confidence" }),
  drill({ title: "Plyo warm-up: Pogo jumps", pillar: "Plyo" }),
  juggleCatch,
  juggleKeep,
];

const nobody = { has_wall: false, space: "open" as const };
const switchedOff = { ...nobody, offer_opt_in: false, opt_in_drill_ids: [juggleCatch.id] };
const switchedOnNoPicks = { ...nobody, offer_opt_in: true, opt_in_drill_ids: [] as string[] };
const offeredCatch = { ...nobody, offer_opt_in: true, opt_in_drill_ids: [juggleCatch.id] };

describe("drillFitsPlayer with course drills", () => {
  it("an opt-in drill does not fit anyone by default", () => {
    expect(drillFitsPlayer(juggleCatch, null)).toBe(false);
    expect(drillFitsPlayer(juggleCatch, nobody)).toBe(false);
  });
  it("picks alone do nothing while the switch is off", () => {
    expect(drillFitsPlayer(juggleCatch, switchedOff)).toBe(false);
    expect(isOffered(juggleCatch, switchedOff)).toBe(false);
  });
  it("the switch alone offers nothing", () => {
    expect(drillFitsPlayer(juggleCatch, switchedOnNoPicks)).toBe(false);
  });
  it("switch on plus the exact drill ticked fits, and only that drill", () => {
    expect(drillFitsPlayer(juggleCatch, offeredCatch)).toBe(true);
    expect(drillFitsPlayer(juggleKeep, offeredCatch)).toBe(false);
  });
  it("ordinary drills are untouched by the rule", () => {
    expect(drillFitsPlayer(bank[0], null)).toBe(true);
    expect(drillFitsPlayer(bank[0], switchedOff)).toBe(true);
  });
});

describe("offeredBank", () => {
  it("removes every opt-in drill for a player with none offered", () => {
    const titles = offeredBank(bank, nobody).map((d) => d.title);
    expect(titles).not.toContain(juggleCatch.title);
    expect(titles).not.toContain(juggleKeep.title);
    expect(titles).toContain("Figure-8 dribble");
  });
  it("keeps exactly the offered drills", () => {
    const titles = offeredBank(bank, offeredCatch).map((d) => d.title);
    expect(titles).toContain(juggleCatch.title);
    expect(titles).not.toContain(juggleKeep.title);
  });
  it("the AI's menu never lists a course drill, offered or not; the system places them", () => {
    const ctx = methodologyContext(offeredBank(bank, nobody));
    expect(ctx).not.toContain("Juggling:");
    const ctx2 = methodologyContext(offeredBank(bank, offeredCatch));
    expect(ctx2).not.toContain("Juggling:");
    expect(ctx2).toContain("Figure-8 dribble");
  });
  it("skillBank is the menu: no plyos, no finishers, no course drills", () => {
    const titles = skillBank(bank).map((d) => d.title);
    expect(titles).not.toContain(juggleCatch.title);
    expect(titles).not.toContain("Plyo warm-up: Pogo jumps");
    expect(titles).toContain("Figure-8 dribble");
  });
});

// Coach Yinka, Oct 24 2026: "when you add them add them after plyometrics
// with the warm up. Keep all other drills." The offered course drills are a
// slot right after the plyo warm-up; the three skill drills stay.
describe("the gates", () => {
  const planNamingJuggling: GeneratedSession[] = [
    {
      title: "Session 1",
      drills: [
        { title: "Plyo warm-up: Pogo jumps", exercise: "x", reps: "x" },
        { title: juggleCatch.title, exercise: "x", reps: "x" },
        { title: "Figure-8 dribble", exercise: "x", reps: "x" },
        { title: "Neymar Feint", exercise: "x", reps: "x" },
      ],
    },
  ];
  const skillsOf = (s: GeneratedSession) => s.drills.filter((d) => isSkillTitle(d.title) && !d.title.startsWith("Juggling:"));
  it("a plan naming a course drill for a player not offered it gets a replacement and still has three skill drills", () => {
    const out = conformSessionsToBank(planNamingJuggling, offeredBank(bank, nobody), nobody, "Focus.", "optional");
    const titles = out.flatMap((s) => s.drills.map((d) => d.title));
    expect(titles).not.toContain(juggleCatch.title);
    expect(titles.filter((t) => t.startsWith("Juggling:"))).toHaveLength(0);
    expect(skillsOf(out[0])).toHaveLength(3);
  });
  it("for a player it was offered to, the course drill sits right after the warm-up and the three skill drills stay", () => {
    const out = conformSessionsToBank(planNamingJuggling, offeredBank(bank, offeredCatch), offeredCatch, "Focus.", "optional");
    const titles = out[0].drills.map((d) => d.title);
    expect(titles[0]).toBe("Plyo warm-up: Pogo jumps");
    expect(titles[1]).toBe(juggleCatch.title);
    expect(titles.slice(2)).toEqual(["Figure-8 dribble", "Neymar Feint", expect.stringMatching(/^(?!Juggling:|Plyo)/)]);
    expect(skillsOf(out[0])).toHaveLength(3);
    expect(titles.filter((t) => t.startsWith("Juggling:"))).toHaveLength(1);
  });
  it("the slot is filled even when the AI never wrote a course drill, and a written one is never kept as a skill drill", () => {
    const plain: GeneratedSession[] = [
      { title: "Session 1", drills: [{ title: "Figure-8 dribble", exercise: "x", reps: "x" }] },
    ];
    const out = conformSessionsToBank(plain, offeredBank(bank, offeredCatch), offeredCatch, "Focus.", "optional");
    const titles = out[0].drills.map((d) => d.title);
    expect(titles[0]).toBe(juggleCatch.title); // no plyo written, so the slot leads
    expect(skillsOf(out[0])).toHaveLength(3);
    expect(titles.filter((t) => t.startsWith("Juggling:"))).toHaveLength(1);
  });
  it("rotates through the ticked drills in ladder order across the week, one per session", () => {
    const both = { ...nobody, offer_opt_in: true, opt_in_drill_ids: [juggleKeep.id, juggleCatch.id] };
    const week: GeneratedSession[] = [1, 2, 3, 4].map((n) => ({
      title: `Session ${n}`,
      drills: [
        { title: "Plyo warm-up: Pogo jumps", exercise: "x", reps: "x" },
        { title: "Figure-8 dribble", exercise: "x", reps: "x" },
      ],
    }));
    const out = conformSessionsToBank(week, offeredBank(bank, both), both, "Focus.", "optional");
    const slot = out.map((s) => s.drills[1].title);
    // juggleCatch sorts 300, juggleKeep 305: catch first, then keep it up, then round again.
    expect(slot).toEqual([juggleCatch.title, juggleKeep.title, juggleCatch.title, juggleKeep.title]);
    for (const s of out) {
      expect(s.drills[0].title).toBe("Plyo warm-up: Pogo jumps");
      expect(skillsOf(s)).toHaveLength(3);
      expect(s.drills.filter((d) => d.title.startsWith("Juggling:"))).toHaveLength(1);
    }
  });
  it("a required finisher still closes the session, after the skill drills", () => {
    const withCore = [...bank, drill({ title: "Strength: Front plank", pillar: "Strengthening" })];
    const out = conformSessionsToBank(planNamingJuggling, offeredBank(withCore, offeredCatch), offeredCatch, "Focus.", "required");
    const titles = out[0].drills.map((d) => d.title);
    expect(titles[0]).toBe("Plyo warm-up: Pogo jumps");
    expect(titles[1]).toBe(juggleCatch.title);
    expect(titles[titles.length - 1]).toBe("Strength: Front plank");
    expect(skillsOf(out[0])).toHaveLength(3);
  });
  it("a few-yards template week gets the same slot after the warm-up", () => {
    const tightOffered = { has_wall: false, space: "tight" as const, offer_opt_in: true, opt_in_drill_ids: [juggleCatch.id] };
    const template = {
      id: "t1",
      title: "Few yards: touches",
      space: "tight" as const,
      sort: 1,
      active: true,
      drills: [bank[0], bank[2], bank[3]],
    };
    const t = templateSessions({ templates: [template], bank, player: tightOffered, count: 2, usage: {}, strength: "optional" })!;
    for (const s of t.sessions) {
      const titles = s.drills.map((d) => d.title);
      expect(titles[0]).toBe("Plyo warm-up: Pogo jumps");
      expect(titles[1]).toBe(juggleCatch.title);
      expect(titles.slice(2)).toEqual(["Figure-8 dribble", "Ronaldinho drill", "Neymar Feint"]);
    }
  });
  it("even an unfiltered bank cannot place a course drill through the fits rule", () => {
    const out = conformSessionsToBank(planNamingJuggling, bank, nobody, "Focus.", "optional");
    const titles = out.flatMap((s) => s.drills.map((d) => d.title));
    expect(titles.filter((t) => t.startsWith("Juggling:"))).toHaveLength(0);
  });
  it("Extra Work never includes a course drill, offered or not", () => {
    for (const player of [nobody, offeredCatch]) {
      for (let i = 0; i < 10; i++) {
        const s = composeExtraSession({
          bank,
          player,
          shelf: "ball_mastery",
          doneTitles: [],
          weekTitles: [],
          strength: "optional",
        });
        const titles = (s?.drills ?? []).map((d) => d.title);
        expect(titles.filter((t) => t.startsWith("Juggling:"))).toHaveLength(0);
      }
    }
  });
});
