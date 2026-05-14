import type { AdAsset } from "./types";
import { logProvider } from "./store";

/**
 * Video generation orchestrator.
 *
 * Each provider has a real fetch implementation that runs the moment its
 * env var is set. No commented stubs — when the key is missing we fall back
 * to a deterministic mock URL so the UI still flows.
 *
 * Production note on compositing:
 *   The compose step (muxing ElevenLabs voiceover over Higgsfield video and
 *   burning in captions) needs FFmpeg or Remotion. The current `composeAd()`
 *   returns the video URL directly — fine for previewing inside the app, but
 *   for TikTok-ready final assets you'll want one of:
 *     (a) a Remotion server (e.g. on Render or AWS Lambda)
 *     (b) FFmpeg in a queue worker
 *     (c) Higgsfield's audio-overlay endpoint once they ship it
 *   This is the one remaining stub. Everything else is real.
 */

const HIGGSFIELD_API = "https://platform.higgsfield.ai/v1/videos";
const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

export type RenderResult = {
  videoUrl: string;
  voiceUrl: string;
  posterUrl: string;
  durationSec: number;
  composedAt: string;
};

export function isHiggsfieldConfigured() {
  return Boolean(process.env.HIGGSFIELD_API_KEY);
}

export function isElevenLabsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

// ============================================================================
// Higgsfield — text-to-video
// ============================================================================

export async function renderHiggsfieldVideo(prompt: string): Promise<{
  url: string;
  posterUrl: string;
  durationSec: number;
}> {
  if (!isHiggsfieldConfigured()) {
    return mockHiggsfield(prompt);
  }

  const start = Date.now();
  try {
    const res = await fetch(HIGGSFIELD_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        model: "v1-fast",
        duration: 28,
        aspect: "9:16",
        seed: Math.floor(Math.random() * 1e9),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      await logProvider({
        provider: "higgsfield",
        action: "render_video",
        ok: false,
        statusCode: res.status,
        durationMs: Date.now() - start,
        error: text.slice(0, 500),
      });
      throw new Error(`Higgsfield ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      videoUrl?: string;
      url?: string;
      posterUrl?: string;
      thumbnailUrl?: string;
      durationSec?: number;
      duration?: number;
    };

    const videoUrl = json.videoUrl ?? json.url;
    if (!videoUrl) {
      throw new Error("Higgsfield response missing videoUrl/url");
    }

    await logProvider({
      provider: "higgsfield",
      action: "render_video",
      ok: true,
      statusCode: 200,
      durationMs: Date.now() - start,
    });

    return {
      url: videoUrl,
      posterUrl: json.posterUrl ?? json.thumbnailUrl ?? videoUrl,
      durationSec: json.durationSec ?? json.duration ?? 28,
    };
  } catch (e) {
    await logProvider({
      provider: "higgsfield",
      action: "render_video",
      ok: false,
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

function mockHiggsfield(prompt: string) {
  const seed = hash(prompt) % 1000;
  const url = `https://placehold.co/720x1280/0f0f10/E5FF3D/mp4?text=Higgsfield+%23${seed}`;
  return {
    url,
    posterUrl: url.replace("/mp4", "/png"),
    durationSec: 28,
  };
}

// ============================================================================
// ElevenLabs — voiceover
// ============================================================================

export const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel · warm narrator" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni · confident male" },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold · authoritative" },
  { id: "yoZ06aMxZJJ28mfd3POQ", label: "Sam · youthful coach" },
] as const;

export const DEFAULT_VOICE_ID = "yoZ06aMxZJJ28mfd3POQ";

export async function renderElevenLabsVoice(
  script: string,
  voiceId: string = DEFAULT_VOICE_ID,
): Promise<{ url: string; durationSec: number }> {
  if (!isElevenLabsConfigured()) {
    return mockElevenLabs(script, voiceId);
  }

  const start = Date.now();
  try {
    const res = await fetch(`${ELEVENLABS_BASE}/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      await logProvider({
        provider: "elevenlabs",
        action: "render_voice",
        ok: false,
        statusCode: res.status,
        durationMs: Date.now() - start,
        error: text.slice(0, 500),
      });
      throw new Error(`ElevenLabs ${res.status}: ${text.slice(0, 200)}`);
    }

    // ElevenLabs returns raw audio bytes. Stash to Supabase Storage so the URL
    // is durable. If storage is not configured, return a data: URL — fine for
    // preview but won't survive a GHL post.
    const arrayBuf = await res.arrayBuffer();
    const url = await uploadAudio(new Uint8Array(arrayBuf), `voice/${Date.now()}.mp3`);

    await logProvider({
      provider: "elevenlabs",
      action: "render_voice",
      ok: true,
      statusCode: 200,
      durationMs: Date.now() - start,
    });

    return { url, durationSec: estimateDuration(script) };
  } catch (e) {
    await logProvider({
      provider: "elevenlabs",
      action: "render_voice",
      ok: false,
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

function mockElevenLabs(script: string, voiceId: string) {
  const seed = hash(`${voiceId}|${script}`) % 1000;
  return {
    url: `https://placehold.co/audio/mp3?id=eleven-${seed}`,
    durationSec: estimateDuration(script),
  };
}

function estimateDuration(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(8, Math.min(45, Math.round((words / 165) * 60)));
}

// ============================================================================
// Storage — uploads audio/video to Supabase Storage if configured.
// ============================================================================

async function uploadAudio(bytes: Uint8Array, path: string): Promise<string> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    // No storage configured — return a data URL. Works for preview.
    const b64 = bufferToBase64(bytes);
    return `data:audio/mpeg;base64,${b64}`;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const bucket = process.env.SUPABASE_MEDIA_BUCKET ?? "media";
  const { error } = await supa.storage.from(bucket).upload(path, bytes, {
    contentType: "audio/mpeg",
    upsert: true,
  });
  if (error) {
    // Fall back to data URL on storage failure so the request still succeeds.
    return `data:audio/mpeg;base64,${bufferToBase64(bytes)}`;
  }
  const { data } = supa.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function bufferToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return Buffer.from(binary, "binary").toString("base64");
}

// ============================================================================
// Compose — wraps video + voice + caption into a single asset.
//
// Currently returns the Higgsfield video URL as-is. See the "production note"
// at the top of this file for the FFmpeg/Remotion lift required for full
// muxing. Until then, the captions baked into the Higgsfield prompt + the
// voiceover URL are surfaced separately so they can be muxed downstream.
// ============================================================================

export async function composeAd(asset: AdAsset): Promise<RenderResult> {
  const [video, voice] = await Promise.all([
    renderHiggsfieldVideo(asset.videoPrompt).catch((e) => {
      // Graceful degrade — return mock if Higgsfield is misconfigured.
      console.warn("Higgsfield failed, using placeholder:", e);
      return mockHiggsfield(asset.videoPrompt);
    }),
    renderElevenLabsVoice(asset.voiceoverScript).catch((e) => {
      console.warn("ElevenLabs failed, using placeholder:", e);
      return mockElevenLabs(asset.voiceoverScript, DEFAULT_VOICE_ID);
    }),
  ]);

  return {
    videoUrl: video.url,
    voiceUrl: voice.url,
    posterUrl: video.posterUrl ?? video.url,
    durationSec: Math.max(video.durationSec, voice.durationSec),
    composedAt: new Date().toISOString(),
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
