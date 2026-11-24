import { UUID, appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { toggleProps } from "@/lib/elite/tracker-actions";

// Props on a friend's post: one tap gives them, another takes them back.
// Only on a post this player can see right now (the website's own action).
//   POST { id }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-props", access: "free_app" }, async ({ req }) => {
  const body = await readJson(req);
  if (typeof body?.id !== "string" || !UUID.test(body.id)) return appJson({ ok: false, error: "That post is not there any more." }, 400);
  const res = await toggleProps(body.id);
  return res.ok ? { ok: true, propped: res.propped } : appJson({ ok: false, error: res.error }, 400);
});
