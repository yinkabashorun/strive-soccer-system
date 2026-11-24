import { UUID, appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { deleteLog, logTraining } from "@/lib/elite/tracker-actions";

// Training logged without a photo, and an entry taken back, through the
// website's own actions (the length, training or gym by grade, the 8 hours
// a day; only ever the player's own row).
//   POST   { minutes, kind }
//   DELETE { id }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-log", access: "free_app", limit: 30 }, async ({ req }) => {
  const body = await readJson(req);
  if (typeof body?.minutes !== "number" || typeof body?.kind !== "string") {
    return appJson({ ok: false, error: "Pick how long you trained." }, 400);
  }
  const res = await logTraining(body.minutes, body.kind);
  return res.ok ? { ok: true, id: res.id } : appJson({ ok: false, error: res.error }, 400);
});

export const DELETE = appRoute({ name: "free-log", access: "free_app", limit: 30 }, async ({ req }) => {
  const body = await readJson(req);
  if (typeof body?.id !== "string" || !UUID.test(body.id)) return appJson({ ok: false, error: "Nothing to delete." }, 400);
  const res = await deleteLog(body.id);
  return res.ok ? { ok: true } : appJson({ ok: false, error: res.error }, 400);
});
