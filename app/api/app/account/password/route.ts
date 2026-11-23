import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { changeMyPassword } from "@/lib/elite/account-actions";

// "Change password" inside the iPhone app, through the website's own
// action: the current password is checked first, then the new one is set.
// The phone stays signed in.
export const dynamic = "force-dynamic";

export const POST = appRoute(
  { name: "account-password", access: "account", limit: 5, windowMs: 10 * 60_000 },
  async ({ req }) => {
    const body = await readJson(req);
    const form = new FormData();
    form.set("current", typeof body?.current === "string" ? body.current.slice(0, 200) : "");
    form.set("next", typeof body?.next === "string" ? body.next.slice(0, 200) : "");
    const res = await changeMyPassword({ error: null, done: false }, form);
    return res.done ? { ok: true } : appJson({ ok: false, error: res.error }, 400);
  }
);
