import { describe, expect, it } from "vitest";
import {
  composeExtraSession,
  conformSessionsToBank,
  drillFitsPlayer,
  isOffered,
  offeredBank,
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

const juggleCatch = drill({ title: "Juggling: one touch, catch", pillar: "Ball Mastery", opt_in: true, small_space: true });
const juggleKeep = drill({ title: "Juggling: one touch, keep it up", pillar: "Ball Mastery", opt_in: true, small_space: true });
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
  it("the AI's menu never lists an unoffered course drill", () => {
    const ctx = methodologyContext(offeredBank(bank, nobody));
    expect(ctx).not.toContain("Juggling:");
    const ctx2 = methodologyContext(offeredBank(bank, offeredCatch));
    expect(ctx2).toContain(juggleCatch.title);
    expect(ctx2).not.toContain(juggleKeep.title);
  });
});

describe("the gates", () => {
  const planNamingJuggling: GeneratedSession[] = [
    {
      title: "Session 1",
      drills: [
        { title: juggleCatch.title, exercise: "x", reps: "x" },
        { title: "Figure-8 dribble", exercise: "x", reps: "x" },
        { title: "Neymar Feint", exercise: "x", reps: "x" },
      ],
    },
  ];
  it("a plan naming a course drill for a player not offered it gets a replacement", () => {
    const out = conformSessionsToBank(planNamingJuggling, offeredBank(bank, nobody), nobody, "Focus.", "optional");
    const titles = out.flatMap((s) => s.drills.map((d) => d.title));
    expect(titles).not.toContain(juggleCatch.title);
    expect(titles.filter((t) => t.startsWith("Juggling:"))).toHaveLength(0);
  });
  it("the same plan keeps the drill for a player it was offered to", () => {
    const out = conformSessionsToBank(planNamingJuggling, offeredBank(bank, offeredCatch), offeredCatch, "Focus.", "optional");
    const titles = out.flatMap((s) => s.drills.map((d) => d.title));
    expect(titles).toContain(juggleCatch.title);
  });
  it("even an unfiltered bank cannot place a course drill through the fits rule", () => {
    const out = conformSessionsToBank(planNamingJuggling, bank, nobody, "Focus.", "optional");
    const titles = out.flatMap((s) => s.drills.map((d) => d.title));
    expect(titles.filter((t) => t.startsWith("Juggling:"))).toHaveLength(0);
  });
  it("Extra Work never reaches for an unoffered course drill", () => {
    for (let i = 0; i < 20; i++) {
      const s = composeExtraSession({
        bank,
        player: nobody,
        shelf: "ball_mastery",
        doneTitles: [],
        weekTitles: [],
        strength: "optional",
      });
      const titles = (s?.drills ?? []).map((d) => d.title);
      expect(titles.filter((t) => t.startsWith("Juggling:"))).toHaveLength(0);
    }
  });
});
