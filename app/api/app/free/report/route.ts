import { UUID, appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { reportPost } from "@/lib/elite/tracker-actions";
import { cleanReason } from "@/lib/elite/tracker";

// Report a friend's post (App Review 1.2: shared content can be reported).
// It leaves the reporter's feed at once and waits for a coach; the coaches
// are texted the first time a post is reported (the website's own action).
//   POST { id, reason }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-report", access: "free_app", limit: 20 }, async ({ req }) => {
  const body = await readJson(req);
  const reason = cleanReason(body?.reason);
  if (typeof body?.id !== "string" || !UUID.test(body.id) || !reason) {
    return appJson({ ok: false, error: "Pick what is wrong with it." }, 400);
  }
  const res = await reportPost(body.id, reason);
  return res.ok ? { ok: true } : appJson({ ok: false, error: res.error }, 400);
});
