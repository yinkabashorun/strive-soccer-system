import { NextResponse } from "next/server";
import { runContactsSync } from "@/lib/sync-contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/cron/sync-contacts
//
// Daily cron that pulls every GHL contact into Supabase. Runs the same
// code as the manual /api/sync/contacts button so behavior is identical.
//
// Auth: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`. When
// CRON_SECRET is not set we accept any caller — useful for local dev,
// noisy in prod. Set the secret in production.

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get("x-strive-cron") === secret) return true;
  return false;
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const startedAt = new Date().toISOString();
  const outcome = await runContactsSync();
  const finishedAt = new Date().toISOString();

  if (!outcome.ok) {
    console.error("[cron/sync-contacts] failed:", outcome.error);
    return NextResponse.json(
      { ok: false, startedAt, finishedAt, error: outcome.error },
      { status: outcome.status },
    );
  }

  console.log(
    `[cron/sync-contacts] ok · synced=${outcome.result.synced} ` +
      `total=${outcome.result.total} wonAdded=${outcome.result.wonAdded} ` +
      `errors=${outcome.result.errors.length}`,
  );

  return NextResponse.json({ ok: true, startedAt, finishedAt, ...outcome.result });
}
