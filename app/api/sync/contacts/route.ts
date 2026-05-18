import { NextResponse } from "next/server";
import { runContactsSync } from "@/lib/sync-contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/sync/contacts — manual trigger from the Integrations page.
// Delegates to runContactsSync() in lib/sync-contacts.ts so the daily cron
// at /api/cron/sync-contacts runs the exact same code path.

export async function GET() {
  const outcome = await runContactsSync();
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }
  return NextResponse.json(outcome.result);
}
