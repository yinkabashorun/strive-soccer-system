import { UUID, appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { appBlockedFor } from "@/lib/elite/free-app-server";
import { unblockPlayer } from "@/lib/elite/tracker-actions";

// The players the caller has blocked, and taking a block back.
//   GET           { blocked: [{ id, name }] }
//   POST { id }   unblock that player (the website's own action; it does
//                 not make the two friends again)
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "free-blocked", access: "free_app" }, async ({ viewer }) => appBlockedFor(viewer));

export const POST = appRoute({ name: "free-blocked", access: "free_app", limit: 20 }, async ({ req }) => {
  const body = await readJson(req);
  if (typeof body?.id !== "string" || !UUID.test(body.id)) return appJson({ ok: false, error: "Nobody to unblock." }, 400);
  const res = await unblockPlayer(body.id);
  return res.ok ? { ok: true } : appJson({ ok: false, error: res.error }, 400);
});
