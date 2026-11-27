import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { acceptPlayTerms } from "@/lib/elite/club-teams-actions";

// The two one-time sheets (077), one tap each, recorded with the
// wording's version by the website's own action: "organizer" before a
// captain starts a club or plans anything ("You're organizing this, not
// Strive."), "player" before a first "I'm in" ("Organized by players, not
// by Strive."). The words are lib/elite/club-teams.ts's, the same ones the
// website shows.
//   POST { kind: "organizer" | "player" }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-play-terms", access: "free_app", limit: 20 }, async ({ req }) => {
  const body = await readJson(req);
  if (body?.kind !== "organizer" && body?.kind !== "player") return appJson({ ok: false, error: "That didn't go through. Try again." }, 400);
  const res = await acceptPlayTerms(body.kind);
  return res.ok ? { ok: true } : appJson({ ok: false, error: res.error }, 400);
});
