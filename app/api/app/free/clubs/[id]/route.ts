import { UUID, appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { appClubPageFor, setClubCountyFromApp } from "@/lib/elite/club-app-server";
import {
  answerClubRequest,
  endMyClub,
  leaveClub,
  makeCaptain,
  newClubLink,
  removeClubMember,
  renameMyClub,
  reportClub,
} from "@/lib/elite/tracker-actions";
import { nyToday } from "@/lib/elite/time";
import { CAPTAIN_ONLY_MEMBER } from "@/lib/elite/tracker";

// One club.
//   GET   its page, for one of its members (anyone else: 404)
//   POST  something a member or its captain does, through the website's
//         own action for it (each checks who is asking for itself):
//     { do: "leave" }                      leave the club
//     { do: "report" }                     report the club's name (a member, not its captain)
//     { do: "rename", name }               the captain
//     { do: "remove", member }             the captain takes a player off, for good
//     { do: "link" }                       the captain makes a new link: the old code stops working
//     { do: "county", county, open }       the captain: the county (and Open to games,
//                                          only while games between clubs are in the app)
//     { do: "end" }                        the captain ends the club
//     { do: "request", player, accept }    the captain lets a player in, or not
export const dynamic = "force-dynamic";

const NOT_FOUND = { error: "not_found" } as const;
const NOT_A_CLUB = "That club is not there any more.";
type Ctx = { params?: { id?: string } };

export function GET(req: Request, ctx?: Ctx): Promise<Response> {
  const id = ctx?.params?.id;
  return appRoute({ name: "free-club", access: "free_app" }, async ({ viewer }) => {
    if (typeof id !== "string" || !UUID.test(id)) return appJson(NOT_FOUND, 404);
    const page = await appClubPageFor(viewer, id, nyToday());
    return page ? { club: page } : appJson(NOT_FOUND, 404);
  })(req);
}

export function POST(req: Request, ctx?: Ctx): Promise<Response> {
  const id = ctx?.params?.id;
  return appRoute({ name: "free-club", access: "free_app", limit: 30 }, async ({ req: r }) => {
    const body = await readJson(r);
    const bad = (error: string) => appJson({ ok: false, error }, 400);
    if (typeof id !== "string" || !UUID.test(id)) return bad(NOT_A_CLUB);
    const answer = (res: { ok: true; code?: string } | { ok: false; error: string }) =>
      res.ok ? { ok: true, ...(res.code ? { code: res.code } : {}) } : bad(res.error);
    switch (body?.do) {
      case "leave":
        return answer(await leaveClub(id));
      case "report":
        return answer(await reportClub(id));
      case "rename":
        if (typeof body.name !== "string") return bad("Give the club a name.");
        return answer(await renameMyClub(id, body.name));
      case "remove":
        if (typeof body.member !== "string" || !UUID.test(body.member)) return bad("Nobody to take off.");
        return answer(await removeClubMember(id, body.member));
      case "captain":
        if (typeof body.member !== "string" || !UUID.test(body.member)) return bad(CAPTAIN_ONLY_MEMBER);
        return answer(await makeCaptain(id, body.member));
      case "link":
        return answer(await newClubLink(id));
      case "county": {
        const county = body.county === null || body.county === "" ? null : body.county;
        if ((county !== null && typeof county !== "string") || typeof body.open !== "boolean") return bad("Pick your club's county from the list.");
        // "Open to games" is the app's to change only while games between
        // clubs are in it (lib/elite/club-games.ts, setClubCountyFromApp)
        return answer(await setClubCountyFromApp(id, county, body.open));
      }
      case "end":
        return answer(await endMyClub(id));
      case "request":
        if (typeof body.player !== "string" || !UUID.test(body.player) || typeof body.accept !== "boolean") return bad("That request is gone.");
        return answer(await answerClubRequest(id, body.player, body.accept));
      default:
        return bad("That didn't go through. Try again.");
    }
  })(req);
}
