// The quiz (Nov 21 2026, marketing/app-redesign/experience.md): the intake
// as one question a screen, tap an answer and the next question comes up
// by itself. It is the same intake as before, reorganised: every field
// completeOnboarding (lib/elite/player-actions.ts) stores is still asked,
// and quizInput below hands that action exactly the shape it always took.
// tests/quiz.test.ts fails when a field the server stores is not asked.
import { PROGRESS_METRICS, type PlayerLevel, type ProgressMetric, type TrainingLoad, type TrainingSpace } from "./types";
import type { OnboardingInput } from "./player-actions";

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
export type HoldsBack = "weak_foot" | "first_touch" | "speed" | "one_v_one";

export type QuizAnswers = {
  gender?: "boy" | "girl";
  team?: TeamTraining;
  holdsBack?: HoldsBack;
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
  ratings: Record<ProgressMetric, number>;
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
    ratings: Object.fromEntries(PROGRESS_METRICS.map((m) => [m, 50])) as Record<ProgressMetric, number>,
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

// "What holds you back most?" The tile's name is what the coach and the
// plan read (the first weakness); the line under it is the player's own
// words. The pictures are stills of Strive's own drill clips.
export const HOLDS_BACK: { id: HoldsBack; label: string; line: string; image: string }[] = [
  { id: "weak_foot", label: "Weak foot", line: "I only trust one foot.", image: "/drills/posters/weak-foot-tap-pull-push.jpg" },
  { id: "first_touch", label: "First touch", line: "The ball gets away.", image: "/drills/posters/weak-foot-pop-and-juggle.jpg" },
  { id: "speed", label: "Speed", line: "I lose the race.", image: "/drills/posters/speed-kneel-and-drive.jpg" },
  { id: "one_v_one", label: "1v1 moves", line: "I can't beat my defender.", image: "/drills/posters/neymar-feint.jpg" },
];

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
  | "team"
  | "holdsBack"
  | "age"
  | "position"
  | "foot"
  | "level"
  | "space"
  | "nearby"
  | "club"
  | "goals"
  | "ratings"
  | "parent";

export type QuizStep = {
  id: QuizStepId;
  // What the intake action stores from this screen.
  fields: (keyof OnboardingInput)[];
  // A tap answers it and the next screen comes up by itself.
  autoAdvance: boolean;
};

export const QUIZ_STEPS: readonly QuizStep[] = [
  { id: "gender", fields: ["gender"], autoAdvance: true },
  { id: "team", fields: ["training_load"], autoAdvance: true },
  { id: "holdsBack", fields: ["weaknesses"], autoAdvance: true },
  { id: "age", fields: ["age"], autoAdvance: true },
  { id: "position", fields: ["position"], autoAdvance: true },
  { id: "foot", fields: ["dominant_foot"], autoAdvance: true },
  { id: "level", fields: ["level"], autoAdvance: true },
  { id: "space", fields: ["space"], autoAdvance: true },
  { id: "nearby", fields: ["has_wall", "has_goal"], autoAdvance: false },
  { id: "club", fields: ["club"], autoAdvance: false },
  { id: "goals", fields: ["goals"], autoAdvance: false },
  { id: "ratings", fields: ["self_assessment"], autoAdvance: false },
  { id: "parent", fields: ["parent_name", "parent_email", "parent_phone"], autoAdvance: false },
];

// Whether a screen has what it needs to move on. A typed screen that is
// optional (the club, the goals) is always ready.
export function stepReady(id: QuizStepId, a: QuizAnswers): boolean {
  switch (id) {
    case "gender":
      return a.gender === "boy" || a.gender === "girl";
    case "team":
      return Boolean(a.team);
    case "holdsBack":
      return Boolean(a.holdsBack);
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
  const holds = HOLDS_BACK.find((h) => h.id === a.holdsBack);
  return {
    age: a.age ?? 0,
    position: (a.position ?? "").trim(),
    level: a.level ?? "Developing",
    club: a.club.trim(),
    dominant_foot: a.foot ?? "Right",
    gender: a.gender === "girl" ? "girl" : "boy",
    goals: splitLines(a.goals),
    weaknesses: holds ? [holds.label] : [],
    self_assessment: Object.fromEntries(PROGRESS_METRICS.map((m) => [m, a.ratings[m]])) as Partial<Record<ProgressMetric, number>>,
    parent_name: a.parentName.trim(),
    parent_email: a.parentEmail.trim(),
    parent_phone: a.parentPhone.trim(),
    has_wall: a.wall,
    has_goal: a.goal,
    training_load: team?.load ?? "in_season",
    space: a.space === "tight" ? "tight" : "open",
  };
}
