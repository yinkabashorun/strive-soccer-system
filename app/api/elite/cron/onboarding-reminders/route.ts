import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/elite/app-url";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { sendPlayerSMS } from "@/lib/elite/sms";
import { NUDGE_LAST_DAY, onboardingNudgeDue } from "@/lib/elite/onboarding-nudge";

export const runtime = "nodejs";
// Never let Next prerender this at build time: a GET route handler with no
// dynamic access gets built ONCE and served from cache forever after -
// which here would mean the cron fires every hour and gets a frozen JSON
// body back without a single line of this file running. Whether the
// handler touched request headers used to depend on CRON_SECRET being set,
// so the route was only dynamic by accident. Now it's dynamic on purpose.
export const dynamic = "force-dynamic";
// force-dynamic alone does NOT stop Next caching this route's database
// reads (see lib/elite/supabase/fresh-fetch.ts). This does, for every
// fetch the route makes, whichever client makes it.
export const fetchCache = "force-no-store";
export const maxDuration = 60;

// Nudges families who redeemed an invite code but never finished the
// in-app intake (elite_players.onboarded_at is still null). Runs daily.
// WHEN is one pure rule, lib/elite/onboarding-nudge.ts: at most three
// texts, on days 1, 4 and 7 after joining, and never after day 8. (It used
// to go out every three days for as long as the profile stayed unfinished,
// with no end.) The words are Coach Yinka's own and are not changed here.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();
  if (!admin) return NextResponse.json({ ok: true, reminded: 0 });

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const oneDayAgo = new Date(now - DAY_MS).toISOString();
  // Nobody past the last day is read at all.
  const tooOld = new Date(now - (NUDGE_LAST_DAY + 1) * DAY_MS).toISOString();
  const appUrl = APP_URL;

  const { data: stale } = await admin
    .from("elite_players")
    .select("id, full_name, joined_at, onboarding_reminder_sent_at")
    .is("onboarded_at", null)
    .lt("joined_at", oneDayAgo)
    .gt("joined_at", tooOld);

  const targets = (stale ?? []).filter((p) =>
    onboardingNudgeDue({
      joinedAt: p.joined_at as string | null,
      lastSentAt: p.onboarding_reminder_sent_at as string | null,
      now,
    })
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
