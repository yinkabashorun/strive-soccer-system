import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { completeOnboarding } from "@/lib/elite/player-actions";
import { cleanAnswers, firstUnanswered, quizInput } from "@/lib/elite/quiz";

// The quiz, finished on the phone: the answers are cleaned to the quiz's
// own choices (lib/elite/quiz.ts cleanAnswers), every question must be
// answered, and the website's own intake action stores them.
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "onboarding", access: "player", limit: 10 }, async ({ req, state }) => {
  if (state.kind !== "onboarding") return appJson({ ok: false, error: "already_done" }, 409);
  const body = await readJson(req);
  const answers = cleanAnswers(body?.answers);
  const missing = firstUnanswered(answers);
  if (missing !== -1) return appJson({ ok: false, error: "unanswered", step: missing }, 400);
  const res = await completeOnboarding(quizInput(answers));
  if (res.ok) return { ok: true };
  // The photo and @username (081) come first; the action says so itself.
  if ("needsSetup" in res && res.needsSetup) return appJson({ ok: false, error: res.error, needsSetup: true }, 409);
  return appJson({ ok: false, error: "not_saved" }, 500);
});
