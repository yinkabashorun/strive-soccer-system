import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { enterDoorCode } from "@/lib/elite/free-door-server";
import { inviteFor } from "@/lib/elite/friend-add-server";
import { INVITE_NOT_ONE, inviteFromParams } from "@/lib/elite/friend-link";
import { profileSetupDue, SETUP_REFUSED } from "@/lib/elite/account-profile";

// THE DOOR (lib/elite/free-door.ts): a new free account types the code a
// teammate or a club's captain sent with their invite. A teammate's code
// sends that teammate a friend request; a club's code asks the captain.
// With a real code the player goes straight to the free app and takes the
// quiz later (migration 090; until it is applied the code still asks and
// the answer says skipped: false).
//
// The photo and the @username come first, as everywhere in the free app:
// the request a teammate or a captain reads carries them.
//   POST { code }  ->  { ok, kind, line, skipped } | { ok: false, error }
//
// The same route is what an invite LINK ends at inside the app
// (lib/elite/friend-link.ts): a link a player in the free app opened shows
// one screen that says who it is from, and its one button sends the code
// here. Nothing is sent by the link itself.
//   GET ?code=&kind=   ->  who the invite is from, as far as the website
//                          shows a visitor (a first name and initials, or
//                          a club's name). Read only.
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "free-code-who", access: "free_app", limit: 30 }, async ({ req, tracker }) => {
  if (!tracker) return appJson({ ok: false, error: "unavailable" }, 409);
  const query = new URL(req.url).searchParams;
  const asked = inviteFromParams({ code: query.get("code"), kind: query.get("kind") });
  if (!asked) return appJson({ ok: false, error: INVITE_NOT_ONE }, 400);
  const res = await inviteFor(tracker, asked);
  return res.ok ? res : appJson(res, 400);
});

export const POST = appRoute({ name: "free-code", access: "free", limit: 12, windowMs: 10 * 60_000 }, async ({ req, viewer, tracker, intake }) => {
  if (!tracker) return appJson({ ok: false, error: "unavailable" }, 409);
  if (profileSetupDue(viewer.setup)) return appJson({ ok: false, error: SETUP_REFUSED }, 409);
  const body = await readJson(req);
  const res = await enterDoorCode({ viewer, tracker, intake, raw: body?.code });
  return res.ok ? res : appJson(res, 400);
});
