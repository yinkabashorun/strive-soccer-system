import type { AdAsset } from "./types";

/**
 * Video generation orchestrator.
 *
 * Pipeline:
 *   1. Higgsfield (or substitute) renders the visual from `videoPrompt`.
 *   2. ElevenLabs renders the voiceover audio from `voiceoverScript`.
 *   3. Server-side compose step merges audio + video + captions.
 *
 * All three are STUBS today. The contract below is what the live providers
 * return — drop the real API call into each function when keys are wired.
 */

const HIGGSFIELD_API = "https://platform.higgsfield.ai/v1/videos";
const ELEVENLABS_API = "https://api.elevenlabs.io/v1/text-to-speech";

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
  durationSec: number;
}> {
  if (!isHiggsfieldConfigured()) {
    return mockHiggsfield(prompt);
  }
  // Real call — wire when HIGGSFIELD_API_KEY is set.
  //
  // const res = await fetch(HIGGSFIELD_API, {
  //   method: "POST",
  //   headers: {
  //     Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}`,
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     prompt,
  //     model: "v1-fast",
  //     duration: 28,
  //     aspect: "9:16",
  //     seed: Math.floor(Math.random() * 1e9),
  //   }),
  // });
  // if (!res.ok) throw new Error(`Higgsfield failed: ${res.status}`);
  // const { videoUrl, durationSec } = await res.json();
  // return { url: videoUrl, durationSec };
  void HIGGSFIELD_API;
  return mockHiggsfield(prompt);
}

function mockHiggsfield(prompt: string) {
  const seed = hash(prompt) % 1000;
  return {
    url: `https://placehold.co/720x1280/0f0f10/E5FF3D/mp4?text=Higgsfield+%23${seed}`,
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
  // Real call — wire when ELEVENLABS_API_KEY is set.
  //
  // const res = await fetch(`${ELEVENLABS_API}/${voiceId}`, {
  //   method: "POST",
  //   headers: {
  //     "xi-api-key": process.env.ELEVENLABS_API_KEY!,
  //     "Content-Type": "application/json",
  //     Accept: "audio/mpeg",
  //   },
  //   body: JSON.stringify({
  //     text: script,
  //     model_id: "eleven_turbo_v2_5",
  //     voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  //   }),
  // });
  // if (!res.ok) throw new Error(`ElevenLabs failed: ${res.status}`);
  // const arrayBuf = await res.arrayBuffer();
  // const url = await uploadToCdn(arrayBuf, "audio/mpeg");
  // return { url, durationSec: estimateDuration(script) };
  void ELEVENLABS_API;
  return mockElevenLabs(script, voiceId);
}

function mockElevenLabs(script: string, voiceId: string) {
  const seed = hash(`${voiceId}|${script}`) % 1000;
  return {
    url: `https://placehold.co/audio/mp3?id=eleven-${seed}`,
    durationSec: estimateDuration(script),
  };
}

function estimateDuration(text: string) {
  // ~165 words/min reading pace → seconds.
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(8, Math.min(45, Math.round((words / 165) * 60)));
}

// ============================================================================
// Composition — merge video + audio + captions into a final asset.
//
// In production this should be:
//   (a) Remotion server render, OR
//   (b) FFmpeg job in a queue, OR
//   (c) Higgsfield's own "with audio" endpoint if/when they ship it.
// ============================================================================

export async function composeAd(asset: AdAsset): Promise<RenderResult> {
  const [video, voice] = await Promise.all([
    renderHiggsfieldVideo(asset.videoPrompt),
    renderElevenLabsVoice(asset.voiceoverScript),
  ]);

  // Stub compose — returns the video URL directly. Real compose step would
  // mux voice over video, burn in captions, and upload final mp4 to CDN.
  return {
    videoUrl: video.url,
    voiceUrl: voice.url,
    posterUrl: video.url.replace(/mp4/, "png"),
    durationSec: Math.max(video.durationSec, voice.durationSec),
    composedAt: new Date().toISOString(),
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
