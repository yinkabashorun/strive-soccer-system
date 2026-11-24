import { QUIZ_STEPS } from "@shared/quiz";
import { FREE_STEPS } from "@shared/free-intake";
import type { AppBootstrap } from "@shared/app-contract";

// The screens of the quiz in order, for whoever is taking it:
//   a member        the website's own questions (lib/elite/quiz.ts QUIZ_STEPS)
//   a member whose  only the screens still owed (the server sends them:
//   account took    AppBootstrap.quizOwed), since everything else was
//   it while free   answered then
//   a free account  the same quiz with three screens accounted for
//                   (lib/elite/free-intake.ts FREE_STEPS)
// The photo and the @username are NOT part of the quiz: they are asked on
// their own screen (app/profile-setup.tsx), before the door for a member
// and before the offer for a free account, so nobody is asked twice.
// Pure, tests/logic.test.ts.
export function quizStepIds(me: Pick<AppBootstrap, "state" | "quizOwed"> | null | undefined): string[] {
  if (me?.state.kind === "free") return FREE_STEPS.map((s) => s.id);
  return me?.quizOwed ?? QUIZ_STEPS.map((s) => s.id);
}

export function isStep(id: string | undefined, order: readonly string[]): id is string {
  return typeof id === "string" && order.includes(id);
}

// The screen after this one, or null for the last.
export function nextStepId(id: string, order: readonly string[]): string | null {
  const i = order.indexOf(id);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

export function stepPosition(id: string, order: readonly string[]): { index: number; total: number } {
  return { index: Math.max(0, order.indexOf(id)), total: order.length };
}
