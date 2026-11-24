import { UUID, appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { answerGame, answerScore, cancelPlan, enterScore, reportPlan, setImIn } from "@/lib/elite/club-teams-actions";
import { NEEDS_ORGANIZER_OK, NEEDS_PLAYER_OK, cleanPlanReason } from "@/lib/elite/club-teams";

// One session or game: what a player or a captain does with it, through
// the website's own action for it (each checks again that the caller is a
// member, or the captain, of a club in it).
//   { do: "in" } / { do: "out" }           I'm in, or out again. The one-time
//                                          player acceptance has to be on file
//                                          (answered with needs: "player")
//   { do: "accept" } / { do: "pass" }      the other captain, on a game request
//                                          (accepting needs the organizer acceptance)
//   { do: "cancel" }                       a captain calls it off before it starts
//   { do: "score", club, opponent }        either captain, once the game has started
//                                          (the organizing club's score first)
//   { do: "confirm" } / { do: "dispute" }  the other captain, on a score
//   { do: "report", reason }               anyone who can see it
export const dynamic = "force-dynamic";

const GONE = "That is not there any more.";

export function POST(req: Request, ctx?: { params?: { id?: string } }): Promise<Response> {
  const id = ctx?.params?.id;
  return appRoute({ name: "free-plan-do", access: "free_app", limit: 30 }, async ({ req: r }) => {
    const body = await readJson(r);
    const bad = (error: string) => appJson({ ok: false, error }, 400);
    if (typeof id !== "string" || !UUID.test(id)) return bad(GONE);
    const answer = (res: { ok: true } | { ok: false; error: string }) => {
      if (res.ok) return { ok: true };
      if (res.error === NEEDS_PLAYER_OK) return { ok: false, needs: "player" };
      if (res.error === NEEDS_ORGANIZER_OK) return { ok: false, needs: "organizer" };
      return bad(res.error);
    };
    switch (body?.do) {
      case "in":
        return answer(await setImIn(id, true));
      case "out":
        return answer(await setImIn(id, false));
      case "accept":
        return answer(await answerGame(id, true));
      case "pass":
        return answer(await answerGame(id, false));
      case "cancel":
        return answer(await cancelPlan(id));
      case "score":
        if (typeof body.club !== "number" || typeof body.opponent !== "number") return bad("Enter both scores.");
        return answer(await enterScore(id, body.club, body.opponent));
      case "confirm":
        return answer(await answerScore(id, true));
      case "dispute":
        return answer(await answerScore(id, false));
      case "report": {
        const reason = cleanPlanReason(body.reason);
        if (!reason) return bad("Pick what is wrong.");
        return answer(await reportPlan(id, reason));
      }
      default:
        return bad("That did not go through. Try again.");
    }
  })(req);
}
