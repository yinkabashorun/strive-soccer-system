// ElevenLabs TTS — converts a voiceover script into MP3 audio.
//
// Returns a base64 data URI so the UI can play it inline with <audio> and we
// can hand the same URI to Higgsfield as the soundtrack for a UGC video.

export function isElevenLabsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
}

export type VoiceoverResult = {
  audioDataUri: string;
  voiceId: string;
  model: string;
};

const ELEVEN_MODEL = "eleven_multilingual_v2";

export async function generateAudio(text: string, voiceIdOverride?: string): Promise<VoiceoverResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = voiceIdOverride || process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) throw new Error("elevenlabs_not_configured");

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: ELEVEN_MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`elevenlabs_${res.status}: ${detail.slice(0, 200)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return {
    audioDataUri: `data:audio/mpeg;base64,${buf.toString("base64")}`,
    voiceId,
    model: ELEVEN_MODEL,
  };
}
