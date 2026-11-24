import { appJson, appRoute } from "@/lib/elite/app-api";
import { freeYouFor } from "@/lib/elite/free-app-server";
import { nyToday } from "@/lib/elite/time";

// The You tab of the free app: the name friends see, the aura level, this
// week and all time.
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "free-you", access: "free_app" }, async ({ viewer, tracker }) => {
  if (!tracker) return appJson({ error: "unavailable" }, 409);
  return freeYouFor(viewer, tracker, nyToday());
});
