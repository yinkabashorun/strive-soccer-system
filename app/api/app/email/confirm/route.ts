import { appRoute, readJson } from "@/lib/elite/app-api";
import { confirmCode } from "@/lib/elite/email-confirm-server";

// "Confirm" (093): the 6 digit code from the email. The server compares it
// with the stored hash and counts wrong tries (lib/elite/email-confirm.ts).
//   POST { code } -> { ok } | { ok: false, reason, error }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "email-confirm", access: "account", limit: 20, windowMs: 10 * 60_000 }, async ({ req, viewer }) => {
  const body = await readJson(req);
  return confirmCode(viewer.profile.id, typeof body?.code === "string" ? body.code.slice(0, 32) : null);
});
