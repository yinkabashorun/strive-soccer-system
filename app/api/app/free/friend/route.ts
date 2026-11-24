import { UUID, appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { answerFriendRequest } from "@/lib/elite/tracker-actions";

// Accept or decline a friend request waiting on this player. Only a
// request addressed to them can be answered (the website's own action).
//   POST { id, accept }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-friend", access: "free_app" }, async ({ req }) => {
  const body = await readJson(req);
  if (typeof body?.id !== "string" || !UUID.test(body.id) || typeof body?.accept !== "boolean") {
    return appJson({ ok: false, error: "That request is gone." }, 400);
  }
  const res = await answerFriendRequest(body.id, body.accept);
  return res.ok ? { ok: true } : appJson({ ok: false, error: res.error }, 400);
});
