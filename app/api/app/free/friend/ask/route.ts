import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { rateLimit } from "@/lib/rate-limit";
import { askFriendByUsername } from "@/lib/elite/friend-add-server";
import { ADD_DAY_FULL, ADD_EMPTY, ADD_TRIES_PER_DAY, ADD_TRIES_PER_MINUTE, DAY_MS } from "@/lib/elite/friend-add";

// "Add a friend" by their EXACT @username (lib/elite/friend-add.ts). The
// one username typed is looked up and that player is sent a friend request
// to accept or decline; nothing else comes back but one plain line. Never a
// partial match, never a list, and a username nobody has reads the same as
// a player who blocked the caller.
//
// How often: a few tries a minute (the route's own limit) and a few more a
// day, counted per player, and a try that matched nobody counts too. The
// day's count is kept in this server's memory (lib/rate-limit.ts), so it is
// a brake, not a wall; the wall is the 30 requests one player can have
// waiting, held by the request function itself.
//   POST { username }  ->  { ok, result, line } | { ok: false, error }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-friend-ask", access: "free_app", limit: ADD_TRIES_PER_MINUTE }, async ({ req, viewer }) => {
  const body = await readJson(req);
  if (typeof body?.username !== "string" || !body.username.trim()) return appJson({ ok: false, error: ADD_EMPTY }, 400);
  if (!rateLimit(`app:free-friend-ask:day:${viewer.profile.id}`, ADD_TRIES_PER_DAY, DAY_MS)) {
    return appJson({ ok: false, error: ADD_DAY_FULL }, 400);
  }
  const res = await askFriendByUsername(viewer, body.username);
  return res.ok ? res : appJson(res, 400);
});
