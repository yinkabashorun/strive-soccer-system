import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { getViewer } from "@/lib/elite/session";
import { parseErrorReport } from "@/lib/elite/app-errors";
import { recordAppError } from "@/lib/elite/app-errors-server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/elite/errors - the error boundaries (app/error.tsx,
// app/global-error.tsx) report every error page a visitor sees. Public
// on purpose: a signed-out visitor can hit an error page too. The body is
// validated and capped (parseErrorReport), the caller is rate-limited,
// and the viewer's role and player come from the session cookie, never
// from the body. Always answers quickly; a failed insert is not the
// visitor's problem.
export async function POST(req: Request) {
  if (!rateLimit(`errors:${clientIp(req)}`, 30, 10 * 60_000)) {
    return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  const report = parseErrorReport(body);
  if (!report) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  const admin = createServiceClient();
  if (!admin) return NextResponse.json({ ok: false, reason: "no service client" });

  const viewer = await getViewer().catch(() => null);
  const recorded = await recordAppError(admin, report, {
    viewerRole: viewer && !viewer.demo ? viewer.role : null,
    playerId: viewer && !viewer.demo ? viewer.playerId : null,
    userAgent: req.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: recorded });
}
