import { UUID, appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { blockPlayer } from "@/lib/elite/tracker-actions";

// Block a player (App Review 1.2: a person can be blocked). The friendship
// ends for both, each stops seeing anything of the other, and they are not
// told (the website's own action).
//   POST { id }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-block", access: "free_app", limit: 20 }, async ({ req }) => {
  const body = await readJson(req);
  if (typeof body?.id !== "string" || !UUID.test(body.id)) return appJson({ ok: false, error: "Nobody to block." }, 400);
  const res = await blockPlayer(body.id);
  return res.ok ? { ok: true } : appJson({ ok: false, error: res.error }, 400);
});
