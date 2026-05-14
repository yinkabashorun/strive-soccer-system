import {
  buildStrategistPrompt,
  pickGoal,
  pickPillar,
  synthesizeAd,
} from "./ai-content";
import { logProvider } from "./store";
import type { AdAsset, AdGoal, AdPillar } from "./types";

/**
 * Direct call to the Anthropic Messages API. No SDK — we just fetch.
 *
 * When ANTHROPIC_API_KEY is missing or the call fails, callers should fall
 * back to the deterministic template via `synthesizeAd()`.
 *
 * Default model: claude-sonnet-4-5 — fast, plenty smart for marketing copy.
 * Bump to claude-opus-4-7 for higher-stakes brand work.
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5";

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type StrategistInput = {
  idea: string;
  pillar?: AdPillar;
  goal?: AdGoal;
  platform?: AdAsset["platform"];
  model?: string;
};

type StrategistJson = {
  hook: string;
  script: string;
  caption: string;
  cta: string;
  videoPrompt: string;
  voiceoverScript: string;
  viralityScore?: number;
  viralityNotes?: string;
};

/**
 * Ask Claude to write the ad. Falls back to synthesizeAd() on any failure so
 * the UI never errors out due to provider hiccups.
 */
export async function generateAdStrategy(
  input: StrategistInput,
): Promise<{ asset: AdAsset; source: "claude" | "fallback" }> {
  const now = new Date();
  const pillar = input.pillar ?? pickPillar(now);
  const goal = input.goal ?? pickGoal(now);
  const platform = input.platform ?? "TikTok";

  if (!isAnthropicConfigured()) {
    return {
      asset: synthesizeAd({ idea: input.idea, pillar, goal, platform }),
      source: "fallback",
    };
  }

  const start = Date.now();
  try {
    const prompt = buildStrategistPrompt({ idea: input.idea, pillar, goal });
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.model ?? DEFAULT_MODEL,
        max_tokens: 1500,
        // Cache the system prompt — saves ~$ per request once warmed.
        system: [
          {
            type: "text",
            text: "You are the AI head of marketing for Strive Soccer. You return only strict JSON matching the schema in the user message. Never include prose outside the JSON.",
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      await logProvider({
        provider: "anthropic",
        action: "generate_ad",
        ok: false,
        statusCode: res.status,
        durationMs: Date.now() - start,
        error: errText.slice(0, 500),
      });
      throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = json.content?.find((c) => c.type === "text")?.text ?? "";
    const parsed = extractJson(text);

    await logProvider({
      provider: "anthropic",
      action: "generate_ad",
      ok: true,
      statusCode: 200,
      durationMs: Date.now() - start,
    });

    const seed = synthesizeAd({ idea: input.idea, pillar, goal, platform });
    const asset: AdAsset = {
      ...seed,
      hook: parsed.hook ?? seed.hook,
      script: parsed.script ?? seed.script,
      caption: parsed.caption ?? seed.caption,
      cta: parsed.cta ?? seed.cta,
      videoPrompt: parsed.videoPrompt ?? seed.videoPrompt,
      voiceoverScript: parsed.voiceoverScript ?? seed.voiceoverScript,
      viralityScore:
        typeof parsed.viralityScore === "number"
          ? Math.max(0, Math.min(100, Math.round(parsed.viralityScore)))
          : seed.viralityScore,
      viralityNotes: parsed.viralityNotes ?? seed.viralityNotes,
    };

    return { asset, source: "claude" };
  } catch (e) {
    await logProvider({
      provider: "anthropic",
      action: "generate_ad",
      ok: false,
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      asset: synthesizeAd({ idea: input.idea, pillar, goal, platform }),
      source: "fallback",
    };
  }
}

function extractJson(s: string): Partial<StrategistJson> {
  // Claude sometimes wraps JSON in ```json fences. Strip them defensively.
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : s;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return {};
  }
}
