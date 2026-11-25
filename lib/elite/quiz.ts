// The quiz (Nov 21 2026, marketing/app-redesign/experience.md): the intake
// as one question a screen, tap an answer and the next question comes up
// by itself. It is the same intake as before, reorganised: every field
// completeOnboarding (lib/elite/player-actions.ts) stores is still asked,
// and quizInput below hands that action exactly the shape it always took.
// tests/quiz.test.ts fails when a field the server stores is not asked.
import type { PlayerLevel, TrainingLoad, TrainingSpace } from "./types";
import type { OnboardingInput } from "./onboarding-input";

// Every field the intake action takes. A Record over the input's own keys,
// so TypeScript refuses this list the day a field is added or removed.
export const ONBOARDING_FIELDS: Record<keyof OnboardingInput, true> = {
  age: true,
  position: true,
  level: true,
  club: true,
  dominant_foot: true,
  gender: true,
  goals: true,
  weaknesses: true,
  self_assessment: true,
  parent_name: true,
  parent_email: true,
  parent_phone: true,
  has_wall: true,
  has_goal: true,
  training_load: true,
  space: true,
};

// ---- The answers, as the screens collect them ----
export type TeamTraining = "1-2" | "3-4" | "5+" | "off";

export type QuizAnswers = {
  gender?: "boy" | "girl";
  team?: TeamTraining;
  age?: number;
  position?: string;
  foot?: "Right" | "Left" | "Both";
  level?: PlayerLevel;
  space?: TrainingSpace;
  wall: boolean;
  goal: boolean;
  nearbyAnswered?: boolean;
  club: string;
  goals: string;
  // The player's own 1 to 5 on every attribute, by attribute id.
  attrs: Partial<Record<AttributeId, number>>;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
};

export function emptyAnswers(knownParentPhone = ""): QuizAnswers {
  return {
    wall: false,
    goal: false,
    club: "",
    goals: "",
    attrs: {},
    parentName: "",
    parentEmail: "",
    parentPhone: knownParentPhone,
  };
}

// ---- The choices on each screen ----
// "How often does your team train?" A team that trains three times or more
// is in season (four sessions a week from us); less than that, or no team
// right now, is the off-season week (six). The same split the form used
// ("3 to 4 times a week or more" / "Less than that, or off season").
export const TEAM_TRAINING: { id: TeamTraining; label: string; load: TrainingLoad }[] = [
  { id: "1-2", label: "Once or twice a week", load: "off_season" },
  { id: "3-4", label: "Three or four times", load: "in_season" },
  { id: "5+", label: "Five or more", load: "in_season" },
  { id: "off", label: "Off season right now", load: "off_season" },
];

// "Rate yourself" (Nov 22 2026, Coach Yinka: "it should just be the more
// in depth form where they fill out attributes ... split into a couple
// pages ... stuff on the ball, then stuff off of the ball"). Replaces the
// four "what holds you back" tiles and the seven 0 to 100 sliders. Each
// attribute is rated 1 to 5 by a tap; the labels are what the coach and the
// plan builder read (self_assessment keys), the line is what the player
// sees under the name. The lowest ones become the player's weaknesses.
export type AttributeGroup = "on" | "off";
export const ATTRIBUTES = [
  { id: "first_touch", group: "on", label: "First touch", line: "The ball sticks when it reaches you." },
  { id: "close_control", group: "on", label: "Close control", line: "Keeping it tight in a small space." },
  { id: "weak_foot", group: "on", label: "Weak foot", line: "Passing and shooting with your other foot." },
  { id: "dribbling", group: "on", label: "Dribbling and 1v1", line: "Taking a defender on and beating them." },
  { id: "short_passing", group: "on", label: "Short passing", line: "Quick, clean passes to feet." },
  { id: "long_passing", group: "on", label: "Long passing", line: "Switching play and driven balls." },
  { id: "shooting", group: "on", label: "Shooting", line: "Striking it clean and on target." },
  { id: "speed", group: "off", label: "Speed", line: "Your first steps and your top speed." },
  { id: "agility", group: "off", label: "Agility", line: "Stopping, turning and changing direction fast." },
  { id: "strength", group: "off", label: "Strength", line: "Holding a player off and winning 50/50s." },
  { id: "fitness", group: "off", label: "Fitness", line: "Still running hard at the end of the game." },
  { id: "scanning", group: "off", label: "Scanning", line: "Looking around before the ball comes to you." },
  { id: "decisions", group: "off", label: "Decision making", line: "Picking the right pass, dribble or shot." },
  { id: "movement", group: "off", label: "Movement", line: "Finding space and getting open." },
  { id: "defending", group: "off", label: "Defending", line: "Winning the ball back." },
] as const satisfies readonly { id: string; group: AttributeGroup; label: string; line: string }[];
export type AttributeId = (typeof ATTRIBUTES)[number]["id"];

export const RATING_MIN = 1;
export const RATING_MAX = 5;
// The words at the two ends and the middle of the scale.
export const RATING_WORDS: Record<1 | 3 | 5, string> = { 1: "Needs work", 3: "Solid", 5: "A strength" };

export function attributesIn(group: AttributeGroup) {
  return ATTRIBUTES.filter((x) => x.group === group);
}

function validRating(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= RATING_MIN && v <= RATING_MAX;
}

// What a rating page still needs, in one line a player can read above the
// Next button. Nothing is said before the first rating (the page has only
// just opened) or once every row is rated. The simulator, Nov 24 2026: one
// row was missed on a page of seven and Next did nothing, with no word.
export function stillToRate(group: AttributeGroup, attrs: Partial<Record<string, number>>): string | null {
  const rows = attributesIn(group);
  const open = rows.filter((x) => !validRating(attrs[x.id]));
  if (!open.length || open.length === rows.length) return null;
  const more = open.length - 1;
  return more ? `Still to rate: ${open[0].label}, and ${more} more.` : `Still to rate: ${open[0].label}.`;
}

// The attributes the player rated lowest: every one at 3 or under, lowest
// first, ties in the order of the list (on the ball first), at most three.
// A player who rated nothing under 4 gets their single lowest, so the plan
// still has a place to start.
export const MAX_WEAKNESSES = 3;
type Rated = { label: (typeof ATTRIBUTES)[number]["label"]; v: number; i: number };
function ratedLowestFirst(attrs: Partial<Record<string, number>>): Rated[] {
  const rated = ATTRIBUTES.map((x, i) => ({ label: x.label, v: attrs[x.id], i })).filter((r): r is Rated => validRating(r.v));
  return rated.sort((a, b) => a.v - b.v || a.i - b.i);
}
export function lowestAttributes(attrs: Partial<Record<string, number>>): string[] {
  const sorted = ratedLowestFirst(attrs);
  if (!sorted.length) return [];
  const low = sorted.filter((r) => r.v <= 3).slice(0, MAX_WEAKNESSES);
  return (low.length ? low : sorted.slice(0, 1)).map((r) => r.label);
}

// Every attribute the player rated, weakest first, by the same order
// lowestAttributes uses (ties in the order of the list). The offer shown
// to a free account reads down this list for the areas the filmed drill
// bank can train (lib/elite/bank-conform.ts weekPreview).
export function attributesWeakestFirst(attrs: Partial<Record<string, number>>): string[] {
  return ratedLowestFirst(attrs).map((r) => r.label);
}

// What the server stores from the quiz's ratings: only known attributes,
// only whole numbers 1 to 5, keyed by the attribute's label. Run on the
// server too, so a hand-made request cannot store anything else.
export function cleanSelfAssessment(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const src = input as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const x of ATTRIBUTES) {
    const v = src[x.label];
    if (validRating(v)) out[x.label] = v;
  }
  return out;
}

// The scale a stored self-assessment uses: the quiz stores 1 to 5 from
// Nov 22 2026; every row from before holds 0 to 100 (checked: the lowest
// top value among them is 75).
export function selfScale(self: Record<string, unknown> | null | undefined): 5 | 100 {
  const vals = Object.values(self ?? {}).filter((v): v is number => typeof v === "number");
  return vals.length > 0 && vals.every((v) => v <= RATING_MAX) ? 5 : 100;
}

export const AGES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
export const POSITIONS = [
  "Goalkeeper",
  "Center back",
  "Fullback",
  "Defensive midfield",
  "Central midfield",
  "Attacking midfield",
  "Winger",
  "Striker",
];
export const FEET = ["Right", "Left", "Both"] as const;
export const LEVELS: PlayerLevel[] = ["Developing", "Competitive", "Advanced", "Elite"];
export const SPACES: { id: TrainingSpace; label: string; line: string; image: string }[] = [
  { id: "open", label: "Room to run", line: "A yard, a driveway, a park or a garage.", image: "/drills/posters/two-touch-ball-mastery-v1.jpg" },
  { id: "tight", label: "A few yards", line: "A ball and a few yards. Every drill will fit.", image: "/drills/posters/l-turn-roll-touch.jpg" },
];

// ---- The screens, in order ----
export type QuizStepId =
  | "gender"
  | "age"
  | "position"
  | "foot"
  | "level"
  | "club"
  | "onBall"
  | "offBall"
  | "goals"
  | "team"
  | "space"
  | "nearby"
  | "parent";

// The four parts of the quiz, shown above each question.
export type QuizSection = "About you" | "Your game" | "Your training" | "Your parent";

export type QuizStep = {
  id: QuizStepId;
  // What the intake action stores from this screen.
  fields: (keyof OnboardingInput)[];
  // A tap answers it and the next screen comes up by itself.
  autoAdvance: boolean;
  section: QuizSection;
};

export const QUIZ_STEPS: readonly QuizStep[] = [
  { id: "gender", fields: ["gender"], autoAdvance: true, section: "About you" },
  { id: "age", fields: ["age"], autoAdvance: true, section: "About you" },
  { id: "position", fields: ["position"], autoAdvance: true, section: "About you" },
  { id: "foot", fields: ["dominant_foot"], autoAdvance: true, section: "About you" },
  { id: "level", fields: ["level"], autoAdvance: true, section: "About you" },
  { id: "club", fields: ["club"], autoAdvance: false, section: "About you" },
  { id: "onBall", fields: ["self_assessment"], autoAdvance: false, section: "Your game" },
  // The weaknesses come from both rating pages, so they are stored here.
  { id: "offBall", fields: ["self_assessment", "weaknesses"], autoAdvance: false, section: "Your game" },
  { id: "goals", fields: ["goals"], autoAdvance: false, section: "Your game" },
  { id: "team", fields: ["training_load"], autoAdvance: true, section: "Your training" },
  { id: "space", fields: ["space"], autoAdvance: true, section: "Your training" },
  { id: "nearby", fields: ["has_wall", "has_goal"], autoAdvance: false, section: "Your training" },
  { id: "parent", fields: ["parent_name", "parent_email", "parent_phone"], autoAdvance: false, section: "Your parent" },
];

// The words of each question, shared by the website quiz and the iPhone
// app. The team question carries the approved
// video's own wording.
export const QUIZ_QUESTIONS: Record<QuizStepId, { title: string; sub?: string }> = {
  gender: { title: "Boy or girl?", sub: "So the updates about your training read right." },
  team: { title: "How often does your team train?", sub: "Your week fits around it." },
  age: { title: "How old are you?" },
  position: { title: "What position do you play?", sub: "Your main one." },
  foot: { title: "Which is your strong foot?" },
  level: { title: "What level do you play at?" },
  space: { title: "Where will you train most days?", sub: "Every drill will fit the space you have." },
  nearby: { title: "What is near where you train?", sub: "Tick any you have. Your drills only use what is there." },
  club: { title: "What team do you play for?", sub: "Club and age group, if you have one." },
  goals: { title: "What are you chasing?", sub: "One goal a line. This one is optional." },
  onBall: { title: "On the ball.", sub: "Rate yourself on each one, 1 to 5. Be honest: the lowest ones are where your training starts." },
  offBall: { title: "Off the ball.", sub: "Your speed, your body and how you read the game. Same scale, 1 to 5." },
  parent: { title: "Your parent or guardian.", sub: "So we can reach them about your training." },
};

// Whether a screen has what it needs to move on. A typed screen that is
// optional (the club, the goals) is always ready.
export function stepReady(id: QuizStepId, a: QuizAnswers): boolean {
  switch (id) {
    case "gender":
      return a.gender === "boy" || a.gender === "girl";
    case "team":
      return Boolean(a.team);
    case "onBall":
    case "offBall":
      return attributesIn(id === "onBall" ? "on" : "off").every((x) => validRating(a.attrs[x.id]));
    case "age":
      return typeof a.age === "number" && a.age > 0;
    case "position":
      return Boolean(a.position?.trim());
    case "foot":
      return Boolean(a.foot);
    case "level":
      return Boolean(a.level);
    case "space":
      return a.space === "open" || a.space === "tight";
    case "nearby":
      return Boolean(a.nearbyAnswered);
    case "parent":
      return a.parentName.trim().length > 0;
    default:
      return true;
  }
}

// The first screen still waiting for an answer, or -1 when every one is
// answered. The finish button checks this, so a skipped answer is asked
// for again rather than saved blank.
export function firstUnanswered(a: QuizAnswers): number {
  return QUIZ_STEPS.findIndex((s) => !stepReady(s.id, a));
}

function splitLines(s: string): string[] {
  return s
    .split(/\n|,/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// The answers as the intake action takes them, the same shape the form
// sent before the quiz.
export function quizInput(a: QuizAnswers): OnboardingInput {
  const team = TEAM_TRAINING.find((t) => t.id === a.team);
  return {
    age: a.age ?? 0,
    position: (a.position ?? "").trim(),
    level: a.level ?? "Developing",
    club: a.club.trim(),
    dominant_foot: a.foot ?? "Right",
    gender: a.gender === "girl" ? "girl" : "boy",
    goals: splitLines(a.goals),
    weaknesses: lowestAttributes(a.attrs),
    self_assessment: cleanSelfAssessment(
      Object.fromEntries(ATTRIBUTES.map((x) => [x.label, a.attrs[x.id]]))
    ),
    parent_name: a.parentName.trim(),
    parent_email: a.parentEmail.trim(),
    parent_phone: a.parentPhone.trim(),
    has_wall: a.wall,
    has_goal: a.goal,
    training_load: team?.load ?? "in_season",
    space: a.space === "tight" ? "tight" : "open",
  };
}

// The answers as they arrive from somewhere that cannot be trusted (the
// native iPhone app's request body, a draft saved on a phone): every field
// is taken only when it is one of the choices above or a short string, so
// nothing else ever reaches the intake action. Unknown keys are dropped.
const MAX_TEXT = 200;
const MAX_GOALS = 600;

function text(v: unknown, max = MAX_TEXT): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export function cleanAnswers(raw: unknown): QuizAnswers {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const a = emptyAnswers();
  if (r.gender === "boy" || r.gender === "girl") a.gender = r.gender;
  if (TEAM_TRAINING.some((t) => t.id === r.team)) a.team = r.team as TeamTraining;
  if (typeof r.age === "number" && AGES.includes(r.age)) a.age = r.age;
  if (typeof r.position === "string" && POSITIONS.includes(r.position)) a.position = r.position;
  if ((FEET as readonly unknown[]).includes(r.foot)) a.foot = r.foot as QuizAnswers["foot"];
  if ((LEVELS as unknown[]).includes(r.level)) a.level = r.level as PlayerLevel;
  if (r.space === "open" || r.space === "tight") a.space = r.space;
  a.wall = r.wall === true;
  a.goal = r.goal === true;
  if (r.nearbyAnswered === true) a.nearbyAnswered = true;
  a.club = text(r.club);
  a.goals = text(r.goals, MAX_GOALS);
  const attrs = r.attrs && typeof r.attrs === "object" ? (r.attrs as Record<string, unknown>) : {};
  for (const x of ATTRIBUTES) {
    const v = attrs[x.id];
    if (validRating(v)) a.attrs[x.id] = v;
  }
  a.parentName = text(r.parentName);
  a.parentEmail = text(r.parentEmail);
  a.parentPhone = text(r.parentPhone, 40);
  return a;
}
