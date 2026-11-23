import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { inAppAgreement } from "@/lib/elite/legal";
import { recordConsent } from "@/lib/elite/legal-server";

// "Before you train" in the app: both boxes, ticked by the person, and the
// name of the adult agreeing, recorded like the website's screen (068).
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "consent", access: "account", limit: 10 }, async ({ req, viewer }) => {
  const body = await readJson(req);
  const agreed = inAppAgreement({ guardian: body?.guardian, terms: body?.terms, guardianName: body?.guardianName });
  if (!agreed.ok) return appJson({ ok: false, error: agreed.error }, 400);
  const ok = await recordConsent({
    profileId: viewer.profile.id,
    source: "in_app",
    guardianName: agreed.name,
    userAgent: req.headers.get("user-agent"),
  });
  return ok ? { ok: true } : appJson({ ok: false, error: "That did not save. Check your connection and try again." }, 500);
});
