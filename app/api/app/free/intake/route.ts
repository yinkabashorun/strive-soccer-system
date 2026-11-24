import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { saveFreeIntake } from "@/lib/elite/free-intake-server";
import { getTargetTable } from "@/lib/elite/tracker-server";

// The quiz, finished by a free account: the same quiz a member takes
// (lib/elite/free-intake.ts). Every screen must be answered; the answers
// are cleaned to the quiz's own choices and stored whole, with the free
// app's own four answers worked out from them.
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-intake", access: "free", limit: 10 }, async ({ req, viewer }) => {
  const body = await readJson(req);
  const res = await saveFreeIntake(viewer.profile.id, body?.answers, await getTargetTable());
  if (res.ok) return { ok: true };
  return appJson({ ok: false, error: res.error, ...(res.step === undefined ? {} : { step: res.step }) }, res.status);
});
