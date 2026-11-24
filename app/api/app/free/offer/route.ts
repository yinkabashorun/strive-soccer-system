import { appJson, appRoute } from "@/lib/elite/app-api";
import { offerFor } from "@/lib/elite/free-app-server";

// The offer a free account sees after the quiz: what its first week would
// go after, named from its own lowest ratings, with drills from the filmed
// bank, and the membership's own words and price (lib/elite/offer.ts).
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "free-offer", access: "free" }, async ({ viewer, state, intake }) => {
  if (state.kind !== "free" || !intake?.answers) return appJson({ error: "quiz_first" }, 409);
  return offerFor(viewer, intake.answers, state.stage);
});
