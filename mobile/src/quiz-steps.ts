import { QUIZ_STEPS, type QuizStepId } from "@shared/quiz";
import type { SetupStep } from "@shared/account-profile";

// The screens of the quiz in order: the website's own questions
// (lib/elite/quiz.ts QUIZ_STEPS), then the profile screens still owed, in
// the website's order (lib/elite/account-profile.ts setupSteps: the
// @username, then the photo), while migration 081 is live. Pure,
// tests/logic.test.ts.
export type StepId = QuizStepId | SetupStep;

export function stepOrder(setup: readonly SetupStep[]): StepId[] {
  return [...QUIZ_STEPS.map((s) => s.id), ...setup];
}

export function isStep(id: string | undefined, setup: readonly SetupStep[]): id is StepId {
  return typeof id === "string" && stepOrder(setup).includes(id as StepId);
}

// The screen after this one, or null for the last.
export function nextStepId(id: StepId, setup: readonly SetupStep[]): StepId | null {
  const order = stepOrder(setup);
  const i = order.indexOf(id);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

export function stepPosition(id: StepId, setup: readonly SetupStep[]): { index: number; total: number } {
  const order = stepOrder(setup);
  return { index: Math.max(0, order.indexOf(id)), total: order.length };
}
