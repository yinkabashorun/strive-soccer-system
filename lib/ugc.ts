// UGC ad generator for the $97 Strive Dribbling Course.
//
// Tuned for the funnel: every output ties back to the VSL section it
// supports, and includes a creator shot list so the Fal.ai prompt has
// something concrete to render against.

import Anthropic from "@anthropic-ai/sdk";
import { isAnthropicConfigured } from "@/lib/ai";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

export type Audience = "player" | "parent" | "both";
export type Platform = "TikTok" | "IG Reel" | "Meta Ad" | "YouTube Shorts";

export type UGCInput = {
  audience: Audience;
  painPoint: string;
  transformation: string;
  tone: string;
  cta: string;
  platform: Platform;
};

export type UGCOutput = {
  hook: string;
  script: string;
  caption: string;
  cta: string;
  shotList: string;
  voiceoverScript: string;
  landingAngle: string;
  vslSection: string;
  provider: "anthropic" | "fallback";
};

const SYSTEM = `You write direct-response UGC ad scripts for Strive Soccer's
$97 Dribbling Course. The course teaches kids the ball mastery moves and
composure that make defenders look slow.

Funnel: UGC ad → VSL landing page → $97 checkout.

Voice rules:
- Direct. Confident. No emoji. No exclamation marks.
- Short sentences. Earn every word.
- Sounds like a real parent or coach, not a marketer.
- Sport-luxury, premium feel.

Format hooks like first-person creator videos shot on a phone. Scripts are
~30 seconds, structured as natural spoken beats with [B-roll: ...] cues
where appropriate. Always end with a concrete CTA that drives to the VSL.`;

function fallbackUGC(input: UGCInput): UGCOutput {
  const audienceLine =
    input.audience === "parent"
      ? "Parent of a kid"
      : input.audience === "player"
        ? "Young player"
        : "Parent and player";
  return {
    hook: `${audienceLine} struggling with ${input.painPoint.toLowerCase()} — watch this.`,
    script: `[0-2s] Quick clip of the pain: ${input.painPoint}.
[2-6s] Voiceover: "Most kids don't lack talent. They lack reps."
[6-15s] Cuts of the transformation: ${input.transformation}.
[15-25s] Coach piece-to-camera explaining the Strive Method in one line.
[25-30s] CTA card: "${input.cta}".`,
    caption: `${input.painPoint.slice(0, 80)} → ${input.transformation.slice(0, 80)}. Link in bio.`,
    cta: input.cta,
    shotList: `1. Tight close-up of the ball moving across the foot.
2. Pull-back wide of the kid losing the ball in chaos (the pain).
3. Coach side-on, demoing the move slowly.
4. Same kid, three weeks later, executing it under pressure.
5. Phone-grip selfie talking head delivering the CTA.`,
    voiceoverScript: `Most kids don't lack talent. They lack the right reps. Five minutes a day. The same drills the elite players run. Thirty days later, you stop recognizing them on the ball. ${input.cta}.`,
    landingAngle: `Lead with the transformation, not the price. Open with the before/after, then the method, then the $97 offer.`,
    vslSection: `Hook section — the first 30 seconds of the VSL where you call out ${input.painPoint.toLowerCase()} and tease the transformation.`,
    provider: "fallback",
  };
}

function parseJSON(raw: string): Omit<UGCOutput, "provider"> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  try {
    return JSON.parse(body) as Omit<UGCOutput, "provider">;
  } catch {
    const s = body.indexOf("{");
    const e = body.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try {
        return JSON.parse(body.slice(s, e + 1)) as Omit<UGCOutput, "provider">;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function generateUGC(input: UGCInput): Promise<UGCOutput> {
  if (!isAnthropicConfigured()) return fallbackUGC(input);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const prompt = `Generate a UGC ad concept for the Strive Dribbling Course ($97).

Audience: ${input.audience}
Pain point: ${input.painPoint}
Desired transformation: ${input.transformation}
Tone: ${input.tone}
CTA: ${input.cta}
Platform: ${input.platform}

Return JSON with these exact keys:
{
  "hook": "scroll-stopping first line (one sentence, no quotes)",
  "script": "natural ~30s spoken script with [B-roll: ...] cues",
  "caption": "social caption under 220 chars, max 2 hashtags",
  "cta": "the final call to action line",
  "shotList": "numbered list of 4-6 shots a creator needs to film, one per line",
  "voiceoverScript": "the spoken voiceover, ~60 words, conversational",
  "landingAngle": "one sentence — what angle the VSL landing page should lean into to match this ad",
  "vslSection": "name the section of the VSL this ad sets up (hook / story / proof / offer / objections / close)"
}

Return only the JSON. No prose around it.`;

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const parsed = parseJSON(text);
    if (
      parsed &&
      parsed.hook &&
      parsed.script &&
      parsed.caption &&
      parsed.cta
    ) {
      return { ...parsed, provider: "anthropic" };
    }
  } catch (err) {
    console.error("[ugc] anthropic failed, using fallback:", err);
  }
  return fallbackUGC(input);
}
