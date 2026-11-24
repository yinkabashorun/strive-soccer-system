import { appJson, appRoute } from "@/lib/elite/app-api";
import { startPass } from "@/lib/elite/squad-pass-server";

// Start an earned month of Strive Pro (three teammates who trained:
// lib/elite/squad-pass.ts). No card. The app then reads who it is again and
// is sent on to the member's side.
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-pass", access: "free", limit: 10 }, async ({ req, viewer }) => {
  const res = await startPass(viewer, req.headers.get("user-agent"));
  return res.ok ? { ok: true } : appJson({ ok: false, error: res.error }, res.status);
});
