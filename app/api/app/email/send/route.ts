import { appRoute } from "@/lib/elite/app-api";
import { sendCode } from "@/lib/elite/email-confirm-server";

// "Send a new code" (093) from the iPhone app. Reachable while the email is
// owed (access "account"); held to one a minute and five an hour by the
// server's own rule (lib/elite/email-confirm.ts), and by the caller limit.
//   POST -> { ok, email } | { ok: false, reason, error, waitSeconds? }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "email-send", access: "account", limit: 10, windowMs: 10 * 60_000 }, ({ viewer }) =>
  sendCode(viewer.profile.id)
);
