import { NextResponse } from "next/server";
import { pickGoal, pickPillar } from "@/lib/ai-content";
import { generateAdStrategy } from "@/lib/anthropic";
import { composeAd } from "@/lib/video-gen";
import { scheduleTikTokPost } from "@/lib/ghl-social";
import { adAssetToPost, getConfig, savePost, updatePost } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Daily auto-poster.
 *
 * Reads /settings:
 *   - postDays   — runs only on allowed days
 *   - postTimeLocal + postTimezone — scheduled-for slot
 *   - pillarRotation, goalRotation — what to write today
 *   - autoApprove — if true, schedules immediately; if false, sets
 *     awaiting_approval so Yinka taps approve in the queue UI.
 *
 * Protected by ?key=<CRON_SECRET>.
 *
 * Wire on Vercel: vercel.json already has the cron at 0 13 * * * UTC (9am ET).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expected = process.env.CRON_SECRET;
  if (expected && key !== expected) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const config = await getConfig();
  const now = new Date();

  // Respect postDays
  const dowShort = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][
    now.getUTCDay()
  ];
  if (!config.postDays.includes(dowShort)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Today (${dowShort}) is not in postDays`,
    });
  }

  // Determine pillar + goal from config rotation (Sun..Sat indexes)
  const dow = now.getUTCDay();
  const pillar = config.pillarRotation[dow] ?? pickPillar(now);
  const goal = config.goalRotation[dow] ?? pickGoal(now);

  // 1. Generate strategy
  const { asset, source } = await generateAdStrategy({
    idea: "",
    pillar,
    goal,
    platform: "TikTok",
  });

  // 2. Render
  asset.status = "rendering_video";
  const composed = await composeAd(asset);
  asset.videoUrl = composed.videoUrl;
  asset.voiceUrl = composed.voiceUrl;
  asset.posterUrl = composed.posterUrl;
  asset.durationSec = composed.durationSec;

  // 3. Slot for next morning at configured time
  const scheduledFor = nextMorningSlot(
    config.postTimeLocal,
    config.postTimezone,
  );

  asset.scheduledFor = scheduledFor;

  // 4. Persist as awaiting_approval (or auto-approve and schedule)
  const initialStatus = config.autoApprove ? "approved" : "awaiting_approval";
  const stored = adAssetToPost(asset, {
    generatedBy: "cron",
    status: initialStatus,
  });
  stored.scheduledFor = scheduledFor;
  await savePost(stored);

  if (!config.autoApprove) {
    return NextResponse.json({
      ok: true,
      strategist: source,
      post: stored,
      mode: "awaiting_approval",
      scheduledFor,
    });
  }

  // 5. Auto-approve path → push to GHL right now
  const sched = await scheduleTikTokPost({
    caption: stored.caption,
    videoUrl: stored.videoUrl!,
    posterUrl: stored.posterUrl ?? undefined,
    scheduledFor,
  });

  if (!sched.ok) {
    await updatePost(stored.id, { status: "failed" });
    return NextResponse.json(
      { ok: false, error: sched.error, post: stored },
      { status: 502 },
    );
  }

  await updatePost(stored.id, {
    status: "scheduled",
    ghlPostId: sched.ghlPostId ?? null,
  });

  return NextResponse.json({
    ok: true,
    strategist: source,
    post: stored,
    scheduledFor,
    ghlPostId: sched.ghlPostId,
    mock: sched.mock ?? false,
    mode: "auto_approved",
  });
}

export async function POST(req: Request) {
  return GET(req);
}

/**
 * Compute next occurrence of HH:MM in the given timezone, returning UTC ISO.
 * Uses Intl to derive the timezone offset properly without pulling in moment.
 */
function nextMorningSlot(timeLocal: string, tz: string): string {
  const [hh, mm] = timeLocal.split(":").map(Number);
  const now = new Date();

  // Get the offset of `tz` from UTC right now, in minutes.
  // Trick: format "now" in tz, parse back as UTC, diff.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now).reduce<Record<string, string>>((a, p) => {
    if (p.type !== "literal") a[p.type] = p.value;
    return a;
  }, {});
  const asLocal = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMin = (asLocal - now.getTime()) / 60000;

  // Today's HH:MM in tz, in UTC ms.
  const todayInTzMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hh ?? 9,
    mm ?? 0,
    0,
  );
  let utcMs = todayInTzMs - offsetMin * 60000;

  if (utcMs <= now.getTime()) {
    utcMs += 24 * 60 * 60 * 1000;
  }
  return new Date(utcMs).toISOString();
}
