import { NextResponse } from "next/server";
import { generateAudio, isElevenLabsConfigured } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/elevenlabs/voiceover
// Body: { text: string, voiceId?: string }
// Returns: { audioDataUri, voiceId, model } or { error }

export async function POST(req: Request) {
  if (!isElevenLabsConfigured()) {
    return NextResponse.json(
      { error: "elevenlabs_not_configured", hint: "Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID" },
      { status: 503 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });

  try {
    const out = await generateAudio(text, typeof body?.voiceId === "string" ? body.voiceId : undefined);
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "voiceover_failed" },
      { status: 500 },
    );
  }
}
