import { NextResponse } from "next/server";
import {
  generateCaption,
  generateHook,
  generateIdea,
  generateScript,
  generateVoiceover,
  PILLARS,
  type Pillar,
} from "@/lib/ai";

// POST /api/ai/generate
// Body: { kind: "hook" | "caption" | "script" | "voiceover" | "idea", pillar?: Pillar }
//
// Today this returns curated, on-brand templates so the engine works offline.
// Swap in Claude / OpenAI inside the handlers — the response shape stays the same.

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kind = body?.kind ?? "idea";
  const pillar: Pillar =
    body?.pillar && PILLARS.includes(body.pillar) ? body.pillar : "Ball Mastery";

  switch (kind) {
    case "hook":
      return NextResponse.json({ pillar, hook: generateHook(pillar) });
    case "caption":
      return NextResponse.json({ pillar, caption: generateCaption(pillar) });
    case "script":
      return NextResponse.json({ pillar, script: generateScript(pillar) });
    case "voiceover":
      return NextResponse.json({ pillar, voiceover: generateVoiceover(pillar) });
    case "idea":
    default:
      return NextResponse.json(generateIdea(pillar));
  }
}
