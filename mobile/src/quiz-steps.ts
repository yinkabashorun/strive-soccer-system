import { QUIZ_STEPS, type QuizStepId } from "@shared/quiz";

// The screens of the quiz in order: the website's own questions
// (lib/elite/quiz.ts QUIZ_STEPS), then, once the profile step is live on
// the server (migration 081), the profile photo and the @username. Pure,
// tests/quiz-steps.test.ts.
export type StepId = QuizStepId | "photo" | "username";

export function stepOrder(withProfile: boolean): StepId[] {
  return [...QUIZ_STEPS.map((s) => s.id), ...(withProfile ? (["photo", "username"] as const) : [])];
}

export function isStep(id: string | undefined, withProfile: boolean): id is StepId {
  return typeof id === "string" && stepOrder(withProfile).includes(id as StepId);
}

// The screen after this one, or null for the last.
export function nextStepId(id: StepId, withProfile: boolean): StepId | null {
  const order = stepOrder(withProfile);
  const i = order.indexOf(id);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

// "3 of 13" for the bar at the top.
export function stepPosition(id: StepId, withProfile: boolean): { index: number; total: number } {
  const order = stepOrder(withProfile);
  return { index: Math.max(0, order.indexOf(id)), total: order.length };
}
