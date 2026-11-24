import { appJson, appRoute } from "@/lib/elite/app-api";
import { freeWeekFor } from "@/lib/elite/free-app-server";
import { nyToday } from "@/lib/elite/time";

// The Week tab: this week against the target, the days, today's line, the
// week's entries and the board with the friends this player added
// (training time only; gym never counts).
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "free-week", access: "free_app" }, async ({ viewer, tracker, intake }) => {
  if (!tracker) return appJson({ error: "unavailable" }, 409);
  return freeWeekFor(viewer, tracker, intake?.answers ?? null, nyToday());
});
