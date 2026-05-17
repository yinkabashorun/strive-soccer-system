import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  generateCaption,
  generateHook,
  generateScript,
  isAnthropicConfigured,
  PILLARS,
  type Pillar,
} from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/content/generate
// Body: { pillar: Pillar, hook_idea?: string }
// Returns: { hook, script, caption, provider }

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

const STRIVE_SYSTEM = `You write content for Strive Soccer — premium youth training.
Voice: direct, confident, never corny. Short sentences. No emoji. No exclamation marks.
Coach who has been around real players, not a marketer.`;

type Out = { hook: string; script: string; caption: string };

function parseJSON(raw: string): Out | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  try {
    return JSON.parse(body) as Out;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1)) as Out;
      } catch {
        // fall through
      }
    }
    return null;
  }
}

async function liveGenerate(pillar: Pillar, hookIdea?: string): Promise<Out> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const prompt = hookIdea
    ? `Pillar: "${pillar}". Hook idea to refine: "${hookIdea}".
Return JSON: { "hook": "...", "script": "...", "caption": "..." }.
- hook: one sentence, sharpened from the idea, no quotes.
- script: 15-second TikTok beat sheet with timestamps like [0-2s].
- caption: under 220 chars, max 2 hashtags.
Return only the JSON.`
    : `Pillar: "${pillar}". Generate one Reel concept.
Return JSON: { "hook": "...", "script": "...", "caption": "..." }.
- hook: one sentence, no quotes.
- script: 15-second TikTok beat sheet with timestamps like [0-2s].
- caption: under 220 chars, max 2 hashtags.
Return only the JSON.`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: STRIVE_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const parsed = parseJSON(text);
  if (parsed && parsed.hook && parsed.script && parsed.caption) return parsed;
  throw new Error("anthropic_parse_failed");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const pillar: Pillar =
    body?.pillar && PILLARS.includes(body.pillar) ? body.pillar : "Ball Mastery";
  const hookIdea = typeof body?.hook_idea === "string" ? body.hook_idea.trim() : undefined;

  try {
    if (isAnthropicConfigured()) {
      try {
        const out = await liveGenerate(pillar, hookIdea);
        return NextResponse.json({ ...out, provider: "anthropic", pillar });
      } catch (err) {
        console.error("[content/generate] anthropic failed, falling back:", err);
      }
    }
    const [hook, script, caption] = await Promise.all([
      generateHook(pillar),
      generateScript(pillar),
      generateCaption(pillar),
    ]);
    return NextResponse.json({
      hook: hookIdea || hook,
      script,
      caption,
      provider: isAnthropicConfigured() ? "anthropic" : "fallback",
      pillar,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "generation_failed" },
      { status: 500 },
    );
  }
}
