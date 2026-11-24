import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { CLUB_CODE_MESSAGE, clubCodeFrom } from "@/lib/elite/club-app";
import { askToJoinByCode } from "@/lib/elite/club-app-server";

// "Have a club code?": the app cannot open a club's link, so a player
// types the club's code (or pastes the whole link). It ASKS to join; the
// club's captain lets the player in (073). The caps, an ended club and a
// captain's removal are refused in plain words by the website's own rule.
//   POST { code }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-club-join", access: "free_app", limit: 20 }, async ({ req, viewer }) => {
  const body = await readJson(req);
  const code = clubCodeFrom(body?.code);
  if (!code) return appJson({ ok: false, error: CLUB_CODE_MESSAGE }, 400);
  const res = await askToJoinByCode(viewer, code);
  return res.ok ? { ok: true, id: res.id, line: res.line } : appJson({ ok: false, error: res.error }, 400);
});
