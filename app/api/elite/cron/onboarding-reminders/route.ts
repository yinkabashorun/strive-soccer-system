import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { sendPlayerSMS } from "@/lib/elite/sms";

export const runtime = "nodejs";
export const maxDuration = 60;

// Nudges families who redeemed an invite code but never finished the
// in-app intake (elite_players.onboarded_at is still null) - previously
// there was nothing at all reminding them, so a stalled signup just sat
// silently forever. Runs daily; gives a family a full day before the
// first nudge, then re-nudges at most every 3 days so it doesn't spam.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();
  if (!admin) return NextResponse.json({ ok: true, reminded: 0 });

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://thestriveapp.com";

  const { data: stale } = await admin
    .from("elite_players")
    .select("id, full_name, joined_at, onboarding_reminder_sent_at")
    .is("onboarded_at", null)
    .lt("joined_at", oneDayAgo);

  const targets = (stale ?? []).filter(
    (p) => !p.onboarding_reminder_sent_at || p.onboarding_reminder_sent_at < threeDaysAgo
  );

  let reminded = 0;
  for (const p of targets) {
    const first = p.full_name?.split(" ")[0] ?? "";
    const sent = await sendPlayerSMS(p.id, {
      event: "onboarding_incomplete",
      message: `Still need ${first || "your player"}'s Strive Elite profile finished so I can build their first training week. Takes two minutes: ${appUrl}/onboarding. Let's get ${first || "them"} started.`,
    });
    if (sent) {
      await admin
        .from("elite_players")
        .update({ onboarding_reminder_sent_at: new Date().toISOString() })
        .eq("id", p.id);
      reminded++;
    }
  }

  return NextResponse.json({ ok: true, checked: targets.length, reminded });
}
