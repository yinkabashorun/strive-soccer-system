import { NextResponse } from "next/server";
import { buildSchedule, isGHLConfigured, scheduleSocialPost } from "@/lib/ghl";

export const runtime = "nodejs";
export const maxDuration = 60;

type Item = {
  caption: string;
  mediaUrl?: string;
  platform?: "TikTok" | "Instagram" | "YouTube Shorts";
};

// POST /api/ghl/schedule
// Body: { items: Item[], cadence?: "2x-daily" }
// Schedules each item into the next available 2x/day slot (default 11:00, 19:00).

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const items: Item[] = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "items_required" }, { status: 400 });
  }
  const slots = buildSchedule(items.length);
  const results: Array<{ ok: boolean; id?: string; scheduledFor: string; error?: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const scheduledFor = slots[i];
    try {
      const r = await scheduleSocialPost({
        caption: item.caption,
        mediaUrl: item.mediaUrl,
        platform: item.platform ?? "TikTok",
        scheduledFor,
      });
      results.push({ ok: true, id: r.id, scheduledFor: r.scheduledFor });
    } catch (err) {
      results.push({
        ok: false,
        scheduledFor,
        error: err instanceof Error ? err.message : "schedule_failed",
      });
    }
  }

  return NextResponse.json({
    configured: isGHLConfigured(),
    scheduled: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
