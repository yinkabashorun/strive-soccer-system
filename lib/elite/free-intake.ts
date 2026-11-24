// The quiz a FREE account takes (Nov 24 2026): the pure rules.
//
// It is the same quiz a paying member takes (lib/elite/quiz.ts), taken
// once, so the offer that follows it can name the player's own weakest
// areas and so starting a membership later never asks any of it again.
// Three screens differ, and only three:
//
//   age      not asked. A free account gave its birth month and year at
//            sign-up, so its age is already known. In its place the free
//            app's own first question is asked, the school grade, which is
//            the one thing that decides whether a player logs gym work
//            (lib/elite/tracker.ts tracksGym).
//   goals    the typed "What are you chasing?" is asked as the free app's
//            own one-tap question, "What are you working toward?". A
//            membership started later carries the answer over as the goal.
//   parent   not asked. A parent's name and number are only needed once a
//            parent is texted about a week we build, so they are asked
//            after a membership is paid for, never of a free account.
//
// The free app's own short set-up (grade, team level, season, goal) is
// worked out from these answers (trackerQuizFrom), so nobody is asked the
// same thing twice in either direction.
import {
  QUIZ_QUESTIONS,
  QUIZ_STEPS,
  TEAM_TRAINING,
  cleanAnswers,
  stepReady,
  type QuizAnswers,
  type QuizSection,
  type QuizStepId,
} from "./quiz";
import { GOALS, GRADES, labelOf, validateQuiz, type Goal, type Grade, type Level, type Season } from "./tracker";
import type { QuizAnswers as TrackerQuiz } from "./tracker";
import type { PlayerLevel } from "./types";

// The answers as the screens collect them: the member quiz's own shape,
// plus the two the free app asks in its own words.
export type FreeAnswers = QuizAnswers & { grade?: Grade; aim?: Goal };

// Asked of a member only (see the top of this file).
export const MEMBER_ONLY_STEPS: readonly QuizStepId[] = ["parent"];
// A member screen whose answer a free account gives another way.
export const FREE_INSTEAD: Partial<Record<QuizStepId, "grade" | "aim">> = { age: "grade", goals: "aim" };

export type FreeStepId = Exclude<QuizStepId, "age" | "goals" | "parent"> | "grade" | "aim";
export type FreeStep = { id: FreeStepId; autoAdvance: boolean; section: QuizSection };

// The screens, in the member quiz's own order, so the two can never drift:
// a screen added to the member quiz shows up here by itself.
export const FREE_STEPS: readonly FreeStep[] = QUIZ_STEPS.filter((s) => !MEMBER_ONLY_STEPS.includes(s.id)).map((s) => {
  const instead = FREE_INSTEAD[s.id];
  return instead
    ? { id: instead, autoAdvance: true, section: s.section }
    : { id: s.id as FreeStepId, autoAdvance: s.autoAdvance, section: s.section };
});

// The words of each question. The two of its own are the free app's
// (components/elite/TrackerQuiz.tsx); the rest are the member quiz's.
export const FREE_QUESTIONS: Record<FreeStepId, { title: string; sub?: string }> = {
  ...(Object.fromEntries(
    FREE_STEPS.filter((s) => s.id !== "grade" && s.id !== "aim").map((s) => [s.id, QUIZ_QUESTIONS[s.id as QuizStepId]])
  ) as Record<Exclude<FreeStepId, "grade" | "aim">, { title: string; sub?: string }>),
  grade: { title: "What grade are you in?" },
  aim: { title: "What are you working toward?" },
};

const isGrade = (v: unknown): v is Grade => GRADES.some((g) => g.id === v);
const isAim = (v: unknown): v is Goal => GOALS.some((g) => g.id === v);

export function freeStepReady(id: FreeStepId, a: FreeAnswers): boolean {
  if (id === "grade") return isGrade(a.grade);
  if (id === "aim") return isAim(a.aim);
  return stepReady(id, a);
}

// The first screen still waiting for an answer, or -1.
export function firstUnansweredFree(a: FreeAnswers): number {
  return FREE_STEPS.findIndex((s) => !freeStepReady(s.id, a));
}

// The answers as they arrive from a phone, or as they were stored: only
// the quiz's own choices and short strings (cleanAnswers), plus the two
// taps of the free app. What a free account is never asked is never kept.
export function cleanFreeAnswers(raw: unknown): FreeAnswers {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const a: FreeAnswers = cleanAnswers(r);
  delete a.age;
  a.goals = "";
  a.parentName = "";
  a.parentEmail = "";
  a.parentPhone = "";
  if (isGrade(r.grade)) a.grade = r.grade;
  if (isAim(r.aim)) a.aim = r.aim;
  return a;
}

// ---- What the free app's own set-up reads from these answers ----------

// In season or off season, from "How often does your team train?": the
// same split the member's week uses (TEAM_TRAINING).
export function seasonFromTeam(team: QuizAnswers["team"]): Season | null {
  const load = TEAM_TRAINING.find((t) => t.id === team)?.load;
  return load === "in_season" || load === "off_season" ? load : null;
}

// The team level the free app keeps (lib/elite/tracker.ts LEVELS), from the
// level the player gave and their grade. A college player is on a college
// team; the top level is the ECNL and MLS NEXT one; a player still
// developing is on a rec or town team; everyone between is on a travel or
// club team.
export function trackerLevel(level: PlayerLevel | undefined, grade: Grade | undefined): Level | null {
  if (!level || !grade) return null;
  if (level === "Elite") return "elite";
  if (grade === "college_or_older") return "college";
  return level === "Developing" ? "rec" : "travel";
}

// The four answers of the free app's set-up, or null while any is missing.
export function trackerQuizFrom(a: FreeAnswers): TrackerQuiz | null {
  return validateQuiz({
    grade: a.grade,
    level: trackerLevel(a.level, a.grade),
    season: seasonFromTeam(a.team),
    goal: a.aim,
  });
}

// ---- What a membership reads from these answers -----------------------

// The member quiz's answers, from a free account's: everything it already
// gave, its age from its birthday, and its goal in the free app's words.
// The screens it was never asked (the parent) stay empty, and are the only
// ones a new member is then shown (owedMemberSteps).
export function memberAnswersFrom(a: FreeAnswers, age: number | null): QuizAnswers {
  const { grade: _grade, aim, ...rest } = a;
  void _grade;
  const out: QuizAnswers = { ...rest, attrs: { ...a.attrs } };
  if (age !== null && Number.isInteger(age) && age > 0) out.age = age;
  out.goals = labelOf(GOALS, aim);
  return out;
}

// The member quiz screens still waiting for an answer, in order.
export function owedMemberSteps(a: QuizAnswers): QuizStepId[] {
  return QUIZ_STEPS.filter((s) => !stepReady(s.id, a)).map((s) => s.id);
}

// A member's own answers laid over what was carried from the free quiz:
// only the screens that were still owed are taken from the phone, so a
// hand-made request cannot rewrite an answer that was already given.
export function mergeOwed(stored: QuizAnswers, typed: QuizAnswers): QuizAnswers {
  const owed = new Set(owedMemberSteps(stored));
  const out: QuizAnswers = { ...stored, attrs: { ...stored.attrs } };
  if (owed.has("gender")) out.gender = typed.gender;
  if (owed.has("age")) out.age = typed.age;
  if (owed.has("position")) out.position = typed.position;
  if (owed.has("foot")) out.foot = typed.foot;
  if (owed.has("level")) out.level = typed.level;
  if (owed.has("team")) out.team = typed.team;
  if (owed.has("space")) out.space = typed.space;
  if (owed.has("nearby")) {
    out.wall = typed.wall;
    out.goal = typed.goal;
    out.nearbyAnswered = typed.nearbyAnswered;
  }
  if (owed.has("onBall") || owed.has("offBall")) out.attrs = { ...typed.attrs, ...stored.attrs };
  if (owed.has("parent")) {
    out.parentName = typed.parentName;
    out.parentEmail = typed.parentEmail;
    out.parentPhone = typed.parentPhone;
  }
  return out;
}

// ---- Where a free account is ------------------------------------------

//   web     the quiz cannot be stored yet (migration 082 is not applied,
//           or the row could not be read): the free app is the website's,
//           exactly as before the app had one
//   quiz    the quiz has not been answered
//   offer   answered; the week (a target and the days) is not set yet, so
//           the offer is the next screen and the week's set-up follows it
//   ready   in the free app
export type FreeStage = "web" | "quiz" | "offer" | "ready";

export function freeStage(i: { available: boolean; hasIntake: boolean; planned: boolean }): FreeStage {
  if (!i.available) return "web";
  if (!i.hasIntake) return "quiz";
  return i.planned ? "ready" : "offer";
}

// ---- Naming their weakest areas ----------------------------------------

// An attribute's name as it reads inside a sentence: "weak foot",
// "first touch". One reads better turned round.
const AREA_WORDS: Record<string, string> = { "Dribbling and 1v1": "1v1 dribbling" };

export function areaWords(label: string): string {
  return AREA_WORDS[label] ?? label.toLowerCase();
}

// "your weak foot", "your weak foot and first touch", "your weak foot,
// first touch and passing". Null with nothing to name.
export function areasPhrase(labels: readonly string[]): string | null {
  const words = labels.map(areaWords);
  if (words.length === 0) return null;
  if (words.length === 1) return `your ${words[0]}`;
  return `your ${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
