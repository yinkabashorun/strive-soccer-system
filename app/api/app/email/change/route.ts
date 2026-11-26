import { appRoute, readJson } from "@/lib/elite/app-api";
import { changeEmail } from "@/lib/elite/email-confirm-server";

// "Wrong email? Change it" (093): a new address, checked with sign-up's
// rule, refused when another account has it, then a new code sent there.
//   POST { email } -> { ok, email } | { ok: false, reason, error }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "email-change", access: "account", limit: 6, windowMs: 10 * 60_000 }, async ({ req, viewer }) => {
  const body = await readJson(req);
  return changeEmail(viewer.profile.id, typeof body?.email === "string" ? body.email.slice(0, 320) : null);
});
