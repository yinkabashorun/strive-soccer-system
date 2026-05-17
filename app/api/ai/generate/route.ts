import { NextResponse } from "next/server";
import {
  generateCaption,
  generateCreatorPitch,
  generateHook,
  generateIdea,
  generateIdeaFeed,
  generateScript,
  generateVoiceover,
  isAnthropicConfigured,
  PILLARS,
  type Pillar,
} from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/ai/generate
// Body: { kind, pillar?, count? }
// kind: "hook" | "caption" | "script" | "voiceover" | "creatorPitch" | "idea" | "feed"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kind = body?.kind ?? "idea";
  const pillar: Pillar =
    body?.pillar && PILLARS.includes(body.pillar) ? body.pillar : "Ball Mastery";
  const count = Math.min(Math.max(parseInt(body?.count ?? "5", 10) || 5, 1), 10);

  try {
    switch (kind) {
      case "hook":
        return NextResponse.json({
          pillar,
          hook: await generateHook(pillar),
          provider: isAnthropicConfigured() ? "anthropic" : "fallback",
        });
      case "caption":
        return NextResponse.json({
          pillar,
          caption: await generateCaption(pillar),
          provider: isAnthropicConfigured() ? "anthropic" : "fallback",
        });
      case "script":
        return NextResponse.json({
          pillar,
          script: await generateScript(pillar),
          provider: isAnthropicConfigured() ? "anthropic" : "fallback",
        });
      case "voiceover":
        return NextResponse.json({
          pillar,
          voiceover: await generateVoiceover(pillar),
          provider: isAnthropicConfigured() ? "anthropic" : "fallback",
        });
      case "creatorPitch":
        return NextResponse.json({
          pillar,
          creatorPitch: await generateCreatorPitch(pillar),
          provider: isAnthropicConfigured() ? "anthropic" : "fallback",
        });
      case "feed":
        return NextResponse.json({
          ideas: await generateIdeaFeed(count),
          provider: isAnthropicConfigured() ? "anthropic" : "fallback",
        });
      case "idea":
      default:
        return NextResponse.json({
          ...(await generateIdea(pillar)),
          provider: isAnthropicConfigured() ? "anthropic" : "fallback",
        });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "generation_failed" },
      { status: 500 },
    );
  }
}
