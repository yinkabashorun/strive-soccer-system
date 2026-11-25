import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ATTRIBUTES,
  ONBOARDING_FIELDS,
  QUIZ_STEPS,
  SPACES,
  TEAM_TRAINING,
  cleanSelfAssessment,
  emptyAnswers,
  firstUnanswered,
  lowestAttributes,
  selfScale,
  quizInput,
  stepReady,
  stillToRate,
  type QuizAnswers,
} from "@/lib/elite/quiz";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

// The quiz (Nov 21 2026): the intake as one question a screen. It must
// still collect every field the intake action stores, and hand that action
// exactly the shape it always took. Nothing dropped, nothing new stored.

// Every attribute rated 4, the shape a finished rating page leaves.
const allFour = Object.fromEntries(ATTRIBUTES.map((x) => [x.id, 4])) as QuizAnswers["attrs"];

const full = (patch: Partial<QuizAnswers> = {}): QuizAnswers => ({
  ...emptyAnswers("+17035550100"),
  gender: "girl",
  team: "3-4",
  attrs: { ...allFour, weak_foot: 2, speed: 3 },
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
    const src = read("lib/elite/onboarding-input.ts");
    const type = src.slice(src.indexOf("export type OnboardingInput = {"), src.indexOf("};", src.indexOf("export type OnboardingInput = {")));
    const keys = [...type.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
    expect(keys.length).toBe(16);
    expect(Object.keys(ONBOARDING_FIELDS).sort()).toEqual([...keys].sort());
  });

  it("each screen has a stable id, once", () => {
    const ids = QUIZ_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // About you, then your game (on the ball, then off it), then your
    // training, then the parent: Coach Yinka's order, Nov 22 2026.
    expect(ids).toEqual([
      "gender", "age", "position", "foot", "level", "club",
      "onBall", "offBall", "goals",
      "team", "space", "nearby",
      "parent",
    ]);
    const sections = QUIZ_STEPS.map((s) => s.section);
    expect([...new Set(sections)]).toEqual(["About you", "Your game", "Your training", "Your parent"]);
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
      weaknesses: ["Weak foot", "Speed"],
      self_assessment: Object.fromEntries(
        ATTRIBUTES.map((x) => [x.label, x.id === "weak_foot" ? 2 : x.id === "speed" ? 3 : 4])
      ),
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

  it("the attributes split on the ball and off the ball, every one with a plain line", () => {
    const on = ATTRIBUTES.filter((x) => x.group === "on").map((x) => x.label);
    const off = ATTRIBUTES.filter((x) => x.group === "off").map((x) => x.label);
    expect(on).toEqual(["First touch", "Close control", "Weak foot", "Dribbling and 1v1", "Short passing", "Long passing", "Shooting"]);
    expect(off).toEqual(["Speed", "Agility", "Strength", "Fitness", "Scanning", "Decision making", "Movement", "Defending"]);
    for (const x of ATTRIBUTES) {
      expect(x.line.length).toBeGreaterThan(10);
      expect(x.line).not.toMatch(/—/);
    }
    expect(new Set(ATTRIBUTES.map((x) => x.id)).size).toBe(ATTRIBUTES.length);
  });

  it("the weaknesses are the lowest ratings: 3 or under, lowest first, at most three", () => {
    expect(lowestAttributes({ ...allFour, shooting: 1, fitness: 2, speed: 3, agility: 3 })).toEqual(["Shooting", "Fitness", "Speed"]);
    // ties keep the list's order, on the ball first
    expect(lowestAttributes({ ...allFour, defending: 2, first_touch: 2 })).toEqual(["First touch", "Defending"]);
    // nothing under 4: the single lowest, so the plan still has a start
    expect(lowestAttributes({ ...allFour, movement: 5 })).toEqual(["First touch"]);
    expect(lowestAttributes({ ...allFour, first_touch: 5, close_control: 5, weak_foot: 4 })).toEqual(["Weak foot"]);
    expect(lowestAttributes({})).toEqual([]);
  });

  it("only known attributes rated 1 to 5 are stored, by label", () => {
    expect(cleanSelfAssessment({ "First touch": 3, Speed: 5, "Made up": 4, Shooting: 9, Agility: 2.5, Fitness: "4" })).toEqual({
      "First touch": 3,
      Speed: 5,
    });
    expect(cleanSelfAssessment(null)).toEqual({});
    expect(cleanSelfAssessment("x")).toEqual({});
  });

  it("the server cleans the ratings itself", () => {
    expect(read("lib/elite/player-actions.ts")).toContain("self_assessment: cleanSelfAssessment(input.self_assessment)");
  });

  it("old 0 to 100 rows and new 1 to 5 rows are told apart", () => {
    expect(selfScale({ "First touch": 3, Speed: 5 })).toBe(5);
    expect(selfScale({ "Ball Mastery": 75, Speed: 50 })).toBe(100);
    expect(selfScale({})).toBe(100);
    expect(selfScale(null)).toBe(100);
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
    expect(stepReady("onBall", a)).toBe(false);
    expect(stepReady("offBall", a)).toBe(false);
    expect(stepReady("nearby", a)).toBe(false);
    expect(stepReady("club", a)).toBe(true);
    expect(stepReady("goals", a)).toBe(true);
    // a rating page moves on only when every attribute on it is rated
    const onOnly = Object.fromEntries(ATTRIBUTES.filter((x) => x.group === "on").map((x) => [x.id, 3]));
    expect(stepReady("onBall", { ...a, attrs: onOnly })).toBe(true);
    expect(stepReady("offBall", { ...a, attrs: onOnly })).toBe(false);
    expect(stepReady("onBall", { ...a, attrs: { ...onOnly, shooting: 0 } })).toBe(false);
    expect(stepReady("parent", a)).toBe(false);
    expect(stepReady("parent", { ...a, parentName: "Dana" })).toBe(true);
  });

  it("the finish goes back to the first unanswered screen", () => {
    expect(firstUnanswered(full())).toBe(-1);
    expect(firstUnanswered(full({ gender: undefined }))).toBe(0);
    expect(QUIZ_STEPS[firstUnanswered(full({ parentName: " " }))].id).toBe("parent");
    expect(QUIZ_STEPS[firstUnanswered(full({ position: undefined }))].id).toBe("position");
    expect(QUIZ_STEPS[firstUnanswered(full({ attrs: { ...allFour, defending: undefined } }))].id).toBe("offBall");
  });

  // The simulator, Nov 24 2026: one row of seven was missed and Next did
  // nothing, with no word of why. A rating page names the row above Next.
  it("a rating page says which row is still to rate", () => {
    const on = ATTRIBUTES.filter((x) => x.group === "on");
    const all = Object.fromEntries(on.map((x) => [x.id, 3]));
    // nothing rated yet: the page has only just opened, nothing is said
    expect(stillToRate("on", {})).toBeNull();
    // every row rated: nothing left to say
    expect(stillToRate("on", all)).toBeNull();
    expect(stillToRate("on", { ...all, dribbling: undefined })).toBe("Still to rate: Dribbling and 1v1.");
    expect(stillToRate("on", { first_touch: 2, close_control: 3 })).toBe("Still to rate: Weak foot, and 4 more.");
    // a rating that is not on the scale is still open
    expect(stillToRate("on", { ...all, shooting: 0 })).toBe("Still to rate: Shooting.");
    // the other page's ratings do not count for this one
    expect(stillToRate("off", all)).toBeNull();
    expect(stillToRate("off", { ...all, speed: 4 })).toBe("Still to rate: Agility, and 6 more.");
    // it agrees with the rule that lets Next through
    const a = full({ attrs: { ...allFour, dribbling: undefined } });
    expect(stepReady("onBall", a)).toBe(false);
    expect(stillToRate("on", a.attrs)).not.toBeNull();
    // both quiz screens show the line
    expect(read("components/elite/QuizFlow.tsx")).toContain("stillToRate(");
    expect(read("mobile/app/onboarding/[step].tsx")).toContain("stillToRate(");
  });

  it("the quiz screen saves through the same action as before", () => {
    const flow = read("components/elite/QuizFlow.tsx");
    expect(flow).toContain("completeOnboarding(quizInput(a))");
    expect(flow).not.toMatch(/—|\bAI\b|automated|algorithm|streak|missed/i);
  });
});
