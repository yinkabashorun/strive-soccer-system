import { NextResponse } from "next/server";
import {
  buildSchedule,
  isGHLConfigured,
  scheduleSocialPost,
  type SocialPostInput,
} from "@/lib/ghl";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/content/schedule
// Body: { caption: string, mediaUrl?: string, platform?: "TikTok"|"Instagram"|"Facebook"|"YouTube Shorts", scheduledFor?: ISO }
// Returns: { id, scheduledFor, platform, status, configured }
//
// scheduledFor is optional — if omitted, the next 2x/day slot is used.

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const caption = typeof body?.caption === "string" ? body.caption.trim() : "";
  if (!caption) {
    return NextResponse.json({ error: "caption_required" }, { status: 400 });
  }

  const mediaUrl =
    typeof body?.mediaUrl === "string" && body.mediaUrl ? body.mediaUrl : undefined;

  const allowedPlatforms = ["TikTok", "Instagram", "Facebook", "YouTube Shorts"] as const;
  const platform: SocialPostInput["platform"] = allowedPlatforms.includes(body?.platform)
    ? body.platform
    : "TikTok";

  const scheduledFor =
    typeof body?.scheduledFor === "string" && body.scheduledFor
      ? body.scheduledFor
      : buildSchedule(1)[0];

  try {
    const r = await scheduleSocialPost({
      caption,
      mediaUrl,
      platform,
      scheduledFor,
    });
    return NextResponse.json({
      id: r.id,
      scheduledFor: r.scheduledFor,
      platform: r.platform,
      status: r.status,
      configured: isGHLConfigured(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "schedule_failed" },
      { status: 500 },
    );
  }
}
