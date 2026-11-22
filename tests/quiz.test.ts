import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  HOLDS_BACK,
  ONBOARDING_FIELDS,
  QUIZ_STEPS,
  SPACES,
  TEAM_TRAINING,
  emptyAnswers,
  firstUnanswered,
  quizInput,
  stepReady,
  type QuizAnswers,
} from "@/lib/elite/quiz";
import { PROGRESS_METRICS } from "@/lib/elite/types";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

// The quiz (Nov 21 2026): the intake as one question a screen. It must
// still collect every field the intake action stores, and hand that action
// exactly the shape it always took. Nothing dropped, nothing new stored.

const full = (patch: Partial<QuizAnswers> = {}): QuizAnswers => ({
  ...emptyAnswers("+17035550100"),
  gender: "girl",
  team: "3-4",
  holdsBack: "weak_foot",
  age: 13,
  position: "Winger",
  foot: "Left",
  level: "Competitive",
  space: "tight",
  wall: true,
  goal: false,
  nearbyAnswered: true,
  club: " Riverside U14 ",
  goals: "Make the regional squad\nStart every game",
  parentName: " Dana Smith ",
  parentEmail: "dana@example.com",
  ...patch,
});

describe("the quiz asks everything the intake stores", () => {
  it("every field the server action takes is on a screen", () => {
    const asked = new Set(QUIZ_STEPS.flatMap((s) => s.fields));
    for (const f of Object.keys(ONBOARDING_FIELDS)) expect(asked, f).toContain(f);
    // and nothing that is not a field
    for (const f of asked) expect(Object.keys(ONBOARDING_FIELDS)).toContain(f);
  });

  it("the field list is the action's own input type, every key", () => {
    const src = read("lib/elite/player-actions.ts");
    const type = src.slice(src.indexOf("export type OnboardingInput = {"), src.indexOf("};", src.indexOf("export type OnboardingInput = {")));
    const keys = [...type.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
    expect(keys.length).toBe(16);
    expect(Object.keys(ONBOARDING_FIELDS).sort()).toEqual([...keys].sort());
  });

  it("each screen has a stable id, once", () => {
    const ids = QUIZ_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The approved video's two questions are early, in this order.
    expect(ids.indexOf("team")).toBe(1);
    expect(ids.indexOf("holdsBack")).toBe(2);
    expect(ids[ids.length - 1]).toBe("parent");
  });
});

describe("the answers reach the action unchanged in shape", () => {
  it("maps every answer", () => {
    const input = quizInput(full());
    expect(input).toEqual({
      age: 13,
      position: "Winger",
      level: "Competitive",
      club: "Riverside U14",
      dominant_foot: "Left",
      gender: "girl",
      goals: ["Make the regional squad", "Start every game"],
      weaknesses: ["Weak foot"],
      self_assessment: Object.fromEntries(PROGRESS_METRICS.map((m) => [m, 50])),
      parent_name: "Dana Smith",
      parent_email: "dana@example.com",
      parent_phone: "+17035550100",
      has_wall: true,
      has_goal: false,
      training_load: "in_season",
      space: "tight",
    });
  });

  it("team training follows the form's old split: three or more in season, else off season", () => {
    const load = (team: QuizAnswers["team"]) => quizInput(full({ team })).training_load;
    expect(load("1-2")).toBe("off_season");
    expect(load("3-4")).toBe("in_season");
    expect(load("5+")).toBe("in_season");
    expect(load("off")).toBe("off_season");
    expect(TEAM_TRAINING.map((t) => t.label)).toEqual([
      "Once or twice a week",
      "Three or four times",
      "Five or more",
      "Off season right now",
    ]);
  });

  it("the weak spot is stored as the tile's own name, in the player's words on screen", () => {
    expect(HOLDS_BACK.map((h) => [h.label, h.line])).toEqual([
      ["Weak foot", "I only trust one foot."],
      ["First touch", "The ball gets away."],
      ["Speed", "I lose the race."],
      ["1v1 moves", "I can't beat my defender."],
    ]);
    expect(quizInput(full({ holdsBack: "one_v_one" })).weaknesses).toEqual(["1v1 moves"]);
  });

  it("the pictures are Strive's own drill stills, never stock or a youth photo", () => {
    for (const img of [...HOLDS_BACK, ...SPACES].map((h) => h.image)) {
      expect(img).toMatch(/^\/drills\/posters\/[a-z0-9-]+\.jpg$/);
      expect(() => read(`public${img}`)).not.toThrow();
    }
  });

  it("a known parent phone is kept and never asked twice", () => {
    expect(emptyAnswers("+17035550100").parentPhone).toBe("+17035550100");
    expect(quizInput(full({ parentPhone: "" })).parent_phone).toBe("");
  });
});

describe("a screen moves on only when it is answered", () => {
  it("the tap screens need their tap; the typed extras are optional", () => {
    const a = emptyAnswers();
    expect(stepReady("gender", a)).toBe(false);
    expect(stepReady("team", a)).toBe(false);
    expect(stepReady("holdsBack", a)).toBe(false);
    expect(stepReady("nearby", a)).toBe(false);
    expect(stepReady("club", a)).toBe(true);
    expect(stepReady("goals", a)).toBe(true);
    expect(stepReady("ratings", a)).toBe(true);
    expect(stepReady("parent", a)).toBe(false);
    expect(stepReady("parent", { ...a, parentName: "Dana" })).toBe(true);
  });

  it("the finish goes back to the first unanswered screen", () => {
    expect(firstUnanswered(full())).toBe(-1);
    expect(firstUnanswered(full({ gender: undefined }))).toBe(0);
    expect(QUIZ_STEPS[firstUnanswered(full({ parentName: " " }))].id).toBe("parent");
    expect(QUIZ_STEPS[firstUnanswered(full({ position: undefined }))].id).toBe("position");
  });

  it("the quiz screen saves through the same action as before", () => {
    const flow = read("components/elite/QuizFlow.tsx");
    expect(flow).toContain("completeOnboarding(quizInput(a))");
    expect(flow).not.toMatch(/—|\bAI\b|automated|algorithm|streak|missed/i);
  });
});
