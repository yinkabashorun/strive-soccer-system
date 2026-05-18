import { NextResponse } from "next/server";
import { generateUGC, type UGCInput, type Audience, type Platform } from "@/lib/ugc";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const AUDIENCES = ["player", "parent", "both"] as const;
const PLATFORMS = ["TikTok", "IG Reel", "Meta Ad", "YouTube Shorts"] as const;

function isAudience(v: unknown): v is Audience {
  return typeof v === "string" && (AUDIENCES as readonly string[]).includes(v);
}
function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as readonly string[]).includes(v);
}

// POST /api/ugc/generate
// Body: { audience, painPoint, transformation, tone, cta, platform }
// Returns: { hook, script, caption, cta, shotList, voiceoverScript,
//            landingAngle, vslSection, provider }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const input: UGCInput = {
    audience: isAudience(body.audience) ? body.audience : "both",
    painPoint:
      typeof body.painPoint === "string" && body.painPoint.trim()
        ? body.painPoint.trim()
        : "kid stops playing under pressure",
    transformation:
      typeof body.transformation === "string" && body.transformation.trim()
        ? body.transformation.trim()
        : "confident on the ball, coach is asking what changed",
    tone:
      typeof body.tone === "string" && body.tone.trim()
        ? body.tone.trim()
        : "coach-style",
    cta:
      typeof body.cta === "string" && body.cta.trim()
        ? body.cta.trim()
        : "Get the Strive Dribbling Course — link in bio",
    platform: isPlatform(body.platform) ? body.platform : "TikTok",
  };

  try {
    const out = await generateUGC(input);
    return NextResponse.json({ ...out, input });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "generation_failed" },
      { status: 500 },
    );
  }
}
