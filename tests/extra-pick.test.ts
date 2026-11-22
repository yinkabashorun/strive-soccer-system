import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkPicks,
  composePickedSession,
  EXTRA_PICK_MAX,
  isPickable,
  pickBookendsLine,
  pickButtonLabel,
  pickGroups,
} from "@/lib/elite/extra-pick";
import { composeExtraSession, extraFinisher, extraWarmUp } from "@/lib/elite/bank-conform";
import type { Drill } from "@/lib/elite/types";

// Extra Work, picked by the player (Nov 22 2026, Coach Yinka: "a practical
// system where they can select drills"). The list the player sees and the
// check the server runs are one rule; these tests hold it.
function drill(partial: Partial<Drill> & { title: string; pillar: string }): Drill {
  return {
    id: partial.title.toLowerCase().replace(/\W+/g, "-"),
    how: `How to do ${partial.title}`,
    reps: "3 x 1 min, rest 30 sec",
    minutes: 5,
    cues: "",
    needs_wall: false,
    active: true,
    video_url: `https://thestriveapp.com/drills/${partial.title.toLowerCase().replace(/\W+/g, "-")}.mp4`,
    sort: 0,
    ...partial,
  } as Drill;
}

const figure8 = drill({ title: "Figure-8 dribble", pillar: "Ball Mastery", small_space: true, sort: 10 });
const coneWeave = drill({ title: "Inside-outside cone weave", pillar: "Ball Mastery", sort: 20 });
const tapPull = drill({ title: "Weak foot tap, pull, push", pillar: "Weak Foot", small_space: true });
const wallPass = drill({ title: "Two touch passing", pillar: "Passing", needs_wall: true });
const shot = drill({ title: "Shooting: corner finish", pillar: "Shooting", needs_goal: true });
const maradona = drill({ title: "Maradona", pillar: "Confidence", small_space: true });
const unfilmed = drill({ title: "Elastico", pillar: "Confidence", video_url: "" });
const paused = drill({ title: "Ronaldinho drill", pillar: "Ball Mastery", active: false });
const juggle = drill({ title: "Juggling: one touch, catch", pillar: "Ball Mastery", opt_in: true, small_space: true });
const pogo = drill({ title: "Plyo warm-up: Pogo jumps", pillar: "Plyo", minutes: 4 });
const squat = drill({ title: "Plyo warm-up: Squat jumps", pillar: "Plyo", minutes: 4 });
const plank = drill({ title: "Strength: Front plank", pillar: "Strengthening", minutes: 3 });
const wallSit = drill({ title: "Strength: Wall sit", pillar: "Strengthening", needs_wall: true, minutes: 3 });
const manusClip = drill({ title: "Strength: V-ups", pillar: "Strengthening", video_url: "https://files.manuscdn.com/x/v-ups.mp4" });

const bank: Drill[] = [
  figure8, coneWeave, tapPull, wallPass, shot, maradona, unfilmed, paused, juggle, pogo, squat, plank, wallSit, manusClip,
];

const noWall = { has_wall: false, has_goal: false, space: "open" as const };
const withWall = { has_wall: true, has_goal: true, space: "open" as const };
const fewYards = { has_wall: false, space: "tight" as const };
const offered = { ...noWall, offer_opt_in: true, opt_in_drill_ids: [juggle.id] };

const ids = (ds: Drill[]) => ds.map((d) => d.id);

describe("what the player can pick", () => {
  it("only active, filmed drills that fit; never a plyo", () => {
    const g = pickGroups(bank, noWall);
    const shown = g.flatMap((x) => x.drills.map((d) => d.id));
    expect(shown).toContain(figure8.id);
    expect(shown).toContain(plank.id);
    expect(shown).not.toContain(wallPass.id); // needs a wall
    expect(shown).not.toContain(wallSit.id); // needs a wall
    expect(shown).not.toContain(shot.id); // needs a goal
    expect(shown).not.toContain(unfilmed.id);
    expect(shown).not.toContain(paused.id);
    expect(shown).not.toContain(pogo.id);
    expect(shown).not.toContain(juggle.id); // a course drill nobody offered
  });

  it("a wall and a goal open their drills", () => {
    const shown = pickGroups(bank, withWall).flatMap((x) => x.drills.map((d) => d.id));
    expect(shown).toEqual(expect.arrayContaining([wallPass.id, wallSit.id, shot.id]));
  });

  it("a few yards shows only the drills ticked for a few yards, strength still fits", () => {
    const shown = pickGroups(bank, fewYards).flatMap((x) => x.drills.map((d) => d.id));
    expect(shown).toContain(figure8.id);
    expect(shown).not.toContain(coneWeave.id);
    expect(shown).toContain(plank.id);
  });

  it("an offered course drill can be picked, an unoffered one cannot", () => {
    expect(isPickable(juggle, offered)).toBe(true);
    expect(isPickable(juggle, noWall)).toBe(false);
  });

  it("groups by area with plain names, bank order inside, labels stripped, posters on our own clips", () => {
    const g = pickGroups(bank, noWall, new Set([figure8.id]));
    expect(g.map((x) => x.label)).toEqual(["Ball mastery", "Weak foot", "1v1 moves", "Strength"]);
    const ball = g.find((x) => x.key === "ball_mastery")!;
    expect(ball.drills.map((d) => d.id)).toEqual([figure8.id, coneWeave.id]);
    expect(ball.drills[0].doneBefore).toBe(true);
    expect(ball.drills[1].doneBefore).toBe(false);
    expect(ball.drills[0].poster).toBe("/drills/posters/figure-8-dribble.jpg");
    const strength = g.find((x) => x.key === "strength")!;
    expect(strength.drills.find((d) => d.id === plank.id)!.title).toBe("Front plank");
    expect(strength.drills.find((d) => d.id === manusClip.id)!.poster).toBeNull();
  });
});

describe("the server's check of the picks", () => {
  it("keeps the order they were tapped", () => {
    const res = checkPicks([tapPull.id, figure8.id, maradona.id], bank, noWall);
    expect(res.ok && ids(res.drills)).toEqual([tapPull.id, figure8.id, maradona.id]);
  });

  it("refuses an empty list, a non-list and junk entries", () => {
    expect(checkPicks([], bank, noWall).ok).toBe(false);
    expect(checkPicks(null, bank, noWall).ok).toBe(false);
    expect(checkPicks("figure-8-dribble", bank, noWall).ok).toBe(false);
    expect(checkPicks([42], bank, noWall).ok).toBe(false);
  });

  it(`refuses more than ${EXTRA_PICK_MAX} and the same drill twice`, () => {
    const many = Array.from({ length: EXTRA_PICK_MAX + 1 }, (_, i) => `x${i}`);
    const over = checkPicks(many, bank, noWall);
    expect(over.ok).toBe(false);
    expect(checkPicks([figure8.id, figure8.id], bank, noWall).ok).toBe(false);
  });

  it("refuses an unknown, unfilmed, paused, unfitting, plyo or unoffered course drill", () => {
    for (const bad of ["no-such-drill", unfilmed.id, paused.id, wallPass.id, shot.id, pogo.id, juggle.id]) {
      expect(checkPicks([figure8.id, bad], bank, noWall).ok).toBe(false);
    }
    expect(checkPicks([juggle.id], bank, offered).ok).toBe(true);
  });
});

describe("the picked session", () => {
  const base = { bank, player: noWall, doneTitles: [] as string[], weekTitles: [] as string[] };

  it("warm-up first, then the picks in tap order", () => {
    const res = composePickedSession({ ...base, picks: [maradona.id, figure8.id] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.drills[0].pillar).toBe("Plyo");
    expect(ids(res.drills.slice(1))).toEqual([maradona.id, figure8.id]);
    expect(res.drills.every((d) => d.id && d.video_url)).toBe(true);
  });

  it("the warm-up prefers a plyo that is not already in this week", () => {
    const res = composePickedSession({ ...base, picks: [figure8.id], weekTitles: [pogo.title] });
    expect(res.ok && res.drills[0].id).toBe(squat.id);
  });

  it("picked strength drills sit last, in tap order, after every skill drill", () => {
    const res = composePickedSession({ ...base, picks: [plank.id, figure8.id, manusClip.id, tapPull.id] });
    expect(res.ok && ids(res.drills.slice(1))).toEqual([figure8.id, tapPull.id, plank.id, manusClip.id]);
  });

  it("a required finisher is added last when none was picked, never twice", () => {
    const added = composePickedSession({ ...base, picks: [figure8.id], strength: "required" });
    expect(added.ok && added.drills.at(-1)!.pillar).toBe("Strengthening");
    expect(added.ok && added.drills.length).toBe(3);
    const own = composePickedSession({ ...base, picks: [figure8.id, plank.id], strength: "required" });
    expect(own.ok && own.drills.filter((d) => d.pillar === "Strengthening").map((d) => d.id)).toEqual([plank.id]);
    const optional = composePickedSession({ ...base, picks: [figure8.id] });
    expect(optional.ok && optional.drills.some((d) => d.pillar === "Strengthening")).toBe(false);
  });

  it("the added finisher fits the player (no wall sit without a wall)", () => {
    const onlyWallSit = bank.filter((d) => d.id !== plank.id && d.id !== manusClip.id);
    expect(extraFinisher(onlyWallSit, noWall, [], [])).toBeNull();
    expect(extraFinisher(onlyWallSit, withWall, [], [])!.id).toBe(wallSit.id);
  });

  it("a bad pick list writes nothing", () => {
    expect(composePickedSession({ ...base, picks: [figure8.id, wallPass.id] }).ok).toBe(false);
  });

  it("the shelves use the same warm-up and finisher rule", () => {
    const s = composeExtraSession({ ...base, shelf: "ball_mastery", strength: "required" })!;
    expect(s.drills[0].title).toBe(extraWarmUp(bank, [])!.title);
    expect(s.drills.at(-1)!.title).toBe(extraFinisher(bank, noWall, [], [])!.title);
  });
});

describe("the words", () => {
  it("say what is added and what the button does", () => {
    expect(pickButtonLabel(0)).toBe("Pick a drill");
    expect(pickButtonLabel(1)).toBe("Add 1 drill");
    expect(pickButtonLabel(4)).toBe("Add 4 drills");
    expect(pickBookendsLine({ warmUp: true, finisherAdded: true })).toBe(
      "We add a warm-up first and a strength finisher last."
    );
    expect(pickBookendsLine({ warmUp: true, finisherAdded: false })).toBe("We add a warm-up first.");
  });

  it("the picker's copy has no em dash and never says AI", () => {
    for (const f of ["components/elite/ExtraPicker.tsx", "components/elite/ExtraWork.tsx", "lib/elite/extra-pick.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toContain("—");
      expect(src).not.toMatch(/["'`][^"'`]*\b(AI|automated|algorithm)\b[^"'`]*["'`]/);
    }
  });

  it("the server action re-checks every pick and the one-open-extra rule", () => {
    const src = readFileSync("lib/elite/extra-actions.ts", "utf8");
    expect(src).toMatch(/export async function addPickedExtraSession\(drillIds: unknown\)/);
    expect(src).toContain("composePickedSession(");
    expect(src).toContain("Finish the extra session you already have");
    expect(src).toMatch(/viewer\.demo\) return \{ ok: true as const, session: null/);
  });
});

describe("Extra Work needs an active membership", () => {
  it("the shared loader checks the same door as the app", () => {
    const src = readFileSync(`${__dirname}/../lib/elite/extra-actions.ts`, "utf8");
    const loader = src.slice(src.indexOf("async function loadExtraContext"));
    expect(loader).toMatch(/membershipGate\(player\.subscription_status\)/);
  });
});
