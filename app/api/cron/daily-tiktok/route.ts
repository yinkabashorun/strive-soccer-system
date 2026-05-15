import { NextResponse } from "next/server";
import { pickGoal, pickPillar } from "@/lib/ai-content";
import { generateAdStrategy } from "@/lib/anthropic";
import { buildHiggsfieldPrompt } from "@/lib/higgsfield-prompt";
import { adAssetToPost, getConfig, savePost } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Daily strategist cron — hybrid Higgsfield workflow.
 *
 * Path 3 (the one we agreed on): the cron does NOT try to render video.
 * Higgsfield has no public REST API, so we can't call it from the server.
 *
 * Instead the cron:
 *   1. Picks today's pillar + goal from /settings
 *   2. Claude (Anthropic API) writes hook, script, caption, CTA, video prompt
 *   3. Composes a Claude.ai prompt block (see lib/higgsfield-prompt.ts)
 *   4. Saves the post as `awaiting_video` in the queue
 *
 * Yinka opens /queue, hits "Open in Claude.ai" on today's card, Claude
 * (with the Higgsfield MCP connected) generates the video, Yinka pastes the
 * returned URL back into the queue, status flips to `awaiting_approval`,
 * tap approve → GHL schedules to TikTok.
 *
 * Protected by ?key=<CRON_SECRET>. Wired in vercel.json at 0 13 * * * UTC.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expected = process.env.CRON_SECRET;
  if (expected && key !== expected) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  try {
    const config = await getConfig();
    const now = new Date();

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

    const dow = now.getUTCDay();
    const pillar = config.pillarRotation[dow] ?? pickPillar(now);
    const goal = config.goalRotation[dow] ?? pickGoal(now);

    const { asset, source } = await generateAdStrategy({
      idea: "",
      pillar,
      goal,
      platform: "TikTok",
    });

    const higgsfieldPrompt = buildHiggsfieldPrompt(
      {
        hook: asset.hook,
        voiceoverScript: asset.voiceoverScript,
        caption: asset.caption,
        pillar: asset.pillar,
        goal: asset.goal,
        videoPrompt: asset.videoPrompt,
      },
      config,
    );

    const scheduledFor = nextMorningSlot(
      config.postTimeLocal,
      config.postTimezone,
    );

    asset.scheduledFor = scheduledFor;

    const stored = adAssetToPost(asset, {
      generatedBy: "cron",
      status: "awaiting_video",
      higgsfieldPrompt,
    });
    stored.scheduledFor = scheduledFor;
    await savePost(stored);

    return NextResponse.json({
      ok: true,
      strategist: source,
      post: stored,
      mode: "awaiting_video",
      scheduledFor,
      avatar: config.higgsfieldAvatarName,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Cron failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}

function nextMorningSlot(timeLocal: string, tz: string): string {
  const [hh, mm] = timeLocal.split(":").map(Number);
  const now = new Date();
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
