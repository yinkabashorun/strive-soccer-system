import { appJson, appRoute } from "@/lib/elite/app-api";
import { freeFeedFor } from "@/lib/elite/free-app-server";
import { nyToday } from "@/lib/elite/time";

// The Friends tab: who trained today, the requests waiting, and the last
// seven days of posts from this player and the friends they added. A
// friend's post from today is locked until the player posts a photo today,
// and a locked post is sent with no photo of it at all (the website's own
// reader and rule: tracker-server.ts feedFor, tracker.ts buildFeed).
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "free-feed", access: "free_app" }, async ({ viewer, tracker }) => {
  if (!tracker) return appJson({ error: "unavailable" }, 409);
  return freeFeedFor(viewer, tracker, nyToday());
});
