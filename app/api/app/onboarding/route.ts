import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { completeOnboarding } from "@/lib/elite/player-actions";
import { cleanAnswers, firstUnanswered, quizInput } from "@/lib/elite/quiz";
import { mergeOwed } from "@/lib/elite/free-intake";
import { memberAnswersFor } from "@/lib/elite/free-upgrade-server";

// The quiz, finished on the phone: the answers are cleaned to the quiz's
// own choices (lib/elite/quiz.ts cleanAnswers), every question must be
// answered, and the website's own intake action stores them.
//
// A member whose account took the quiz while it was free is asked only the
// screens it was never shown: what it already answered is read from its
// own stored answers here, on the server, and the phone's answers fill
// only what is still owed (lib/elite/free-intake.ts mergeOwed).
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "onboarding", access: "player", limit: 10 }, async ({ req, state, viewer }) => {
  if (state.kind !== "onboarding") return appJson({ ok: false, error: "already_done" }, 409);
  const body = await readJson(req);
  const typed = cleanAnswers(body?.answers);
  const carried = await memberAnswersFor(viewer.profile.id).catch(() => null);
  const answers = carried ? mergeOwed(carried, typed) : typed;
  const missing = firstUnanswered(answers);
  if (missing !== -1) return appJson({ ok: false, error: "unanswered", step: missing }, 400);
  const res = await completeOnboarding(quizInput(answers));
  if (res.ok) return { ok: true };
  // The photo and @username (081) come first; the action says so itself.
  if ("needsSetup" in res && res.needsSetup) return appJson({ ok: false, error: res.error, needsSetup: true }, 409);
  return appJson({ ok: false, error: "not_saved" }, 500);
});
