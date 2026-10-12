import { describe, expect, it } from "vitest";
import {
  conformSessionsToBank,
  orderTemplatesForPlayer,
  templateSessions,
} from "@/lib/elite/bank-conform";
import { auditTemplateRows } from "@/lib/elite/health";
import type { Drill, GeneratedSession, SessionTemplate } from "@/lib/elite/types";

// Offer stack item 3b (Oct 12 2026): a few-yards player's week is the
// coach's hand-built templates, rotated, never AI composition.
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

const ron = drill({ title: "Ronaldinho drill", pillar: "Ball Mastery", small_space: true });
const fig = drill({ title: "Figure-8 dribble", pillar: "Ball Mastery", small_space: true });
const ney = drill({ title: "Neymar Feint", pillar: "Confidence", small_space: true });
const mar = drill({ title: "Maradona", pillar: "Confidence", small_space: true });
const ela = drill({ title: "Elastico", pillar: "Confidence", small_space: true });
const wallPass = drill({ title: "Two touch passing", pillar: "Passing", needs_wall: true, small_space: true });
const openOnly = drill({ title: "8-cone freestyle", pillar: "Ball Mastery" });
const plyo1 = drill({ title: "Plyo warm-up: Pogo jumps", pillar: "Plyo" });
const plyo2 = drill({ title: "Plyo warm-up: Squat jumps", pillar: "Plyo" });
const core = drill({ title: "Strength: Core A", pillar: "Strengthening" });
const bank = [ron, fig, ney, mar, ela, wallPass, openOnly, plyo1, plyo2, core];

function tpl(id: string, title: string, drills: Drill[], sort = 0, active = true): SessionTemplate {
  return { id, title, space: "tight", sort, active, drills };
}
const A = tpl("a", "Few yards: touches", [ron, fig, ney], 1);
const B = tpl("b", "Few yards: moves", [mar, ela, ron], 2);
const C = tpl("c", "Few yards: wall", [wallPass, ney, fig], 3);

const aiWeek: GeneratedSession[] = [1, 2, 3, 4].map((n) => ({
  title: `AI session ${n}`,
  drills: [{ title: "8-cone freestyle", exercise: "", reps: "" }],
}));
const tight = { has_wall: false, space: "tight" as const };

describe("few-yards templates", () => {
  it("a tight-space player's week is the templates, whatever the AI wrote", () => {
    const out = conformSessionsToBank(aiWeek, bank, tight, "", "optional", {
      templates: [A, B, C],
      usage: {},
    });
    expect(out).toHaveLength(4);
    expect(out.map((s) => s.template_id)).toEqual(["a", "b", "c", "a"]);
    for (const s of out) {
      expect(s.drills[0].title).toMatch(/^Plyo warm-up/);
      expect(s.drills.some((d) => d.title === "8-cone freestyle")).toBe(false);
    }
    expect(out[0].drills.slice(1).map((d) => d.title)).toEqual(["Ronaldinho drill", "Figure-8 dribble", "Neymar Feint"]);
  });
  it("an open-space player is untouched by templates", () => {
    const out = conformSessionsToBank(aiWeek, bank, { has_wall: true, space: "open" }, "", "optional", {
      templates: [A, B, C],
      usage: {},
    });
    expect(out.every((s) => !s.template_id)).toBe(true);
  });
  it("rotates least recently used first and never repeats while enough exist", () => {
    const D = tpl("d", "Few yards: more", [ela, fig, mar], 4);
    const t = templateSessions({
      templates: [A, B, C, D],
      bank,
      player: tight,
      count: 4,
      usage: { a: 3, b: 1, c: 2 }, // d never used
      strength: "optional",
    })!;
    expect(t.sessions.map((s) => s.template_id)).toEqual(["d", "b", "c", "a"]);
    expect(t.repeated).toBe(false);
  });
  it("too few templates: repeats the least recent and says so", () => {
    const t = templateSessions({ templates: [A, B], bank, player: tight, count: 4, usage: {}, strength: "optional" })!;
    expect(t.sessions.map((s) => s.template_id)).toEqual(["a", "b", "a", "b"]);
    expect(t.repeated).toBe(true);
  });
  it("a wall drill in a template is dropped for a player with no wall and the session is filled from the few-yards pool", () => {
    const t = templateSessions({ templates: [C], bank, player: tight, count: 1, usage: {}, strength: "optional" })!;
    const skills = t.sessions[0].drills.filter((d) => !/^Plyo/.test(d.title));
    expect(skills).toHaveLength(3);
    expect(skills.map((d) => d.title)).not.toContain("Two touch passing");
    expect(skills.map((d) => d.title)).not.toContain("8-cone freestyle"); // not a few-yards drill
  });
  it("an injury week ends every template session with a finisher", () => {
    const t = templateSessions({ templates: [A, B], bank, player: tight, count: 2, usage: {}, strength: "required" })!;
    for (const s of t.sessions) expect(s.drills[s.drills.length - 1].title).toBe("Strength: Core A");
  });
  it("inactive templates and unfilmed drills never reach a player; no usable template = null (normal composition takes over)", () => {
    const unfilmed = tpl("u", "Unfilmed", [drill({ title: "Secret move", pillar: "Confidence", video_url: "", small_space: true })]);
    const off = tpl("o", "Retired", [ron, fig, ney], 0, false);
    expect(templateSessions({ templates: [unfilmed, off], bank, player: tight, count: 4, usage: {}, strength: "optional" })).toBeNull();
    expect(orderTemplatesForPlayer([B, A], { a: 2 }).map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("auditTemplateRows (few-yards invariants)", () => {
  const row = (session: number, template_id: string | null) => ({ week: 5, session, template_id });
  it("open-space players are never flagged", () => {
    expect(auditTemplateRows("Elias", 5, "open", 0, [row(1, null)])).toEqual([]);
  });
  it("a few-yards player with no templates built yet is flagged once", () => {
    const out = auditTemplateRows("Remi", 5, "tight", 0, [row(1, null), row(2, null)]);
    expect(out).toHaveLength(1);
    expect(out[0].issue).toMatch(/no few-yards sessions built/);
  });
  it("a repeated template in the live week is flagged with the count", () => {
    const out = auditTemplateRows("Remi", 5, "tight", 2, [row(1, "a"), row(2, "b"), row(3, "a"), row(4, "b")]);
    expect(out).toHaveLength(1);
    expect(out[0].issue).toMatch(/only 2 few-yards sessions/);
  });
  it("a clean template week passes", () => {
    expect(auditTemplateRows("Remi", 5, "tight", 4, [row(1, "a"), row(2, "b"), row(3, "c"), row(4, "d")])).toEqual([]);
  });
});
