import { UUID, appJson, appRoute } from "@/lib/elite/app-api";
import { appClubNearFor } from "@/lib/elite/club-app-server";
import { clubGamesInApp } from "@/lib/elite/club-games";

// Clubs near you, for the club's captain only (anyone else: 404): the
// clubs in the club's own county that chose to be open to games, each
// with its name, record and player count, and any club this one already
// played. Never a player. Clubs never message each other: a captain sends
// a game and the other captain accepts or passes.
export const dynamic = "force-dynamic";

const NOT_FOUND = { error: "not_found" } as const;

export function GET(req: Request, ctx?: { params?: { id?: string } }): Promise<Response> {
  const id = ctx?.params?.id;
  return appRoute({ name: "free-club-near", access: "free_app" }, async ({ viewer }) => {
    if (typeof id !== "string" || !UUID.test(id)) return appJson(NOT_FOUND, 404);
    // clubs near you exist to send a game: not in the app while games
    // between clubs are out of it (lib/elite/club-games.ts)
    if (!clubGamesInApp()) return appJson(NOT_FOUND, 404);
    const near = await appClubNearFor(viewer, id);
    return near ? { near } : appJson(NOT_FOUND, 404);
  })(req);
}
