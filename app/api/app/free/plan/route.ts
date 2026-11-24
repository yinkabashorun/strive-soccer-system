import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { planFor } from "@/lib/elite/free-app-server";
import { saveFreePlan } from "@/lib/elite/free-intake-server";

// The week's set-up: the weekly target (the season's recommendation, or
// the player's own) and the days they train. Saving it is what opens the
// free app.
//   GET                    the recommendation and what is set now
//   POST { target, days }  set them
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "free-plan", access: "free" }, async ({ tracker }) => {
  if (!tracker) return appJson({ error: "unavailable" }, 409);
  return planFor(tracker);
});

export const POST = appRoute({ name: "free-plan", access: "free", limit: 20 }, async ({ req, viewer }) => {
  const body = await readJson(req);
  const res = await saveFreePlan({ profileId: viewer.profile.id, setup: viewer.setup, target: body?.target, days: body?.days });
  return res.ok ? { ok: true } : appJson({ ok: false, error: res.error }, res.status);
});
