import { appJson, appRoute } from "@/lib/elite/app-api";
import { startProFromFree } from "@/lib/elite/free-upgrade-server";

// "Start" on the offer: this free account's own member row is made (once)
// and the card checkout is opened for it (lib/elite/free-upgrade-server.ts).
// Who it is for is the signed-in account; the request carries no body.
// Answers with the checkout's address, which the app opens in a sheet.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-upgrade", access: "free_only", limit: 10, windowMs: 10 * 60_000 }, async ({ req, viewer }) => {
  const res = await startProFromFree(viewer, req.headers.get("user-agent"));
  return res.ok ? { ok: true, url: res.url } : appJson({ ok: false, error: res.error }, res.status);
});
