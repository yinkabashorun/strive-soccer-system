import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { deleteOwnAccount } from "@/lib/elite/account-delete";

// "Delete my account" inside the iPhone app (App Review 5.1.1(v)): the
// password again, then the website's own deletion (files, Pro billing,
// the login and everything under it, one text to the coaches). The phone
// signs itself out when this answers ok.
export const dynamic = "force-dynamic";

export const POST = appRoute(
  { name: "account-delete", access: "account", limit: 5, windowMs: 10 * 60_000 },
  async ({ req }) => {
    const body = await readJson(req);
    const password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
    const res = await deleteOwnAccount(password);
    return res.error ? appJson({ ok: false, error: res.error }, 400) : { ok: true };
  }
);
