import { UUID, appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { appProfileFor } from "@/lib/elite/free-app-server";
import { removeFriend, reportLine } from "@/lib/elite/tracker-actions";
import { nyToday } from "@/lib/elite/time";

// One player's profile in the free app.
//   GET   the profile ("me" is the caller's own). Only the player, their
//         friends and the coaches are ever sent one; anyone else, and
//         either side of a block, gets a 404 (the website's own rule).
//   POST  something the caller does about that player, through the
//         website's own action for it (each checks who is asking):
//     { do: "remove" }         take them off my friends, for both of us
//     { do: "report_photo" }   report their profile photo to the coaches
//     { do: "report_line" }    report their Playing for line to the coaches
// Blocking a player is its own route (free/block), as on a post.
export const dynamic = "force-dynamic";

const NOT_FOUND = { error: "not_found" } as const;
type Ctx = { params?: { id?: string } };

export function GET(req: Request, ctx?: Ctx): Promise<Response> {
  const id = ctx?.params?.id;
  return appRoute({ name: "free-profile", access: "free_app" }, async ({ viewer }) => {
    if (typeof id !== "string" || (id !== "me" && !UUID.test(id))) return appJson(NOT_FOUND, 404);
    const profile = await appProfileFor(viewer, id, nyToday());
    return profile ? { profile } : appJson(NOT_FOUND, 404);
  })(req);
}

export function POST(req: Request, ctx?: Ctx): Promise<Response> {
  const id = ctx?.params?.id;
  return appRoute({ name: "free-profile", access: "free_app", limit: 20 }, async ({ req: r }) => {
    const body = await readJson(r);
    if (typeof id !== "string" || !UUID.test(id)) return appJson({ ok: false, error: "That player is not there any more." }, 400);
    const what = body?.do;
    const res =
      what === "remove"
        ? await removeFriend(id)
        : what === "report_photo"
          ? await reportLine(id, "photo")
          : what === "report_line"
            ? await reportLine(id, "line")
            : null;
    if (!res) return appJson({ ok: false, error: "Nothing to do." }, 400);
    return res.ok ? { ok: true } : appJson({ ok: false, error: res.error }, 400);
  })(req);
}
