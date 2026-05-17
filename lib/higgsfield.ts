// Higgsfield — hyper-realistic UGC creator videos.
//
// Higgsfield's API is access-gated; we wrap the published REST surface
// (`/generations` to start a job, `/generations/:id` to poll status). If the
// shape evolves, only this file changes — the routes and UI stay stable.

export function isHiggsfieldConfigured() {
  return Boolean(process.env.HIGGSFIELD_API_KEY);
}

const BASE = process.env.HIGGSFIELD_API_BASE || "https://api.higgsfield.ai/v1";

export type UGCRequest = {
  pitch: string;
  pillar: string;
  creatorStyle?: "young-mom" | "older-athlete" | "soccer-dad" | "teen-creator";
  durationSec?: number;
  audioDataUri?: string;
  productUrl?: string;
};

export type HiggsfieldJob = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  videoUrl?: string;
  posterUrl?: string;
  error?: string;
  provider: "higgsfield" | "mock";
};

const STYLE_PROMPT: Record<NonNullable<UGCRequest["creatorStyle"]>, string> = {
  "young-mom":
    "30s mother filming on phone in car, natural daylight, soccer mom energy, sincere, kid in background.",
  "older-athlete":
    "late teens athletic male, post-training, sweaty, gym/field background, confident handheld delivery.",
  "soccer-dad":
    "40s dad on sideline with phone, casual coach polo, ambient field sound, no-nonsense tone.",
  "teen-creator":
    "16-year-old TikTok creator in bedroom, ring light, fast cuts, gen-z cadence but still grounded.",
};

export async function startUGCVideo(req: UGCRequest): Promise<HiggsfieldJob> {
  if (!isHiggsfieldConfigured()) {
    return {
      id: `mock_${Math.random().toString(36).slice(2, 10)}`,
      status: "queued",
      provider: "mock",
    };
  }

  const style = STYLE_PROMPT[req.creatorStyle ?? "young-mom"];
  const prompt = `Ultra-realistic UGC video of a real person speaking directly to the camera, phone-shot, natural light, no studio look. ${style} The creator delivers this script word for word: """${req.pitch}""" Pillar context: ${req.pillar}. Cinematography: handheld, intimate, 9:16, mild lens distortion. Audio: clean direct dialogue. No on-screen text. No watermarks.`;

  const res = await fetch(`${BASE}/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "ugc",
      prompt,
      script: req.pitch,
      duration_seconds: req.durationSec ?? 30,
      aspect_ratio: "9:16",
      audio_data_uri: req.audioDataUri,
      reference_product_url: req.productUrl,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`higgsfield_${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { id: string; status?: HiggsfieldJob["status"]; video_url?: string; poster_url?: string };
  return {
    id: data.id,
    status: data.status ?? "queued",
    videoUrl: data.video_url,
    posterUrl: data.poster_url,
    provider: "higgsfield",
  };
}

export async function pollUGCVideo(id: string): Promise<HiggsfieldJob> {
  if (!isHiggsfieldConfigured() || id.startsWith("mock_")) {
    // Mock: after a few seconds, return a placeholder. Real polling happens
    // when HIGGSFIELD_API_KEY is set.
    return {
      id,
      status: "processing",
      provider: "mock",
    };
  }
  const res = await fetch(`${BASE}/generations/${id}`, {
    headers: { Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`higgsfield_poll_${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id: string; status: HiggsfieldJob["status"]; video_url?: string; poster_url?: string; error?: string };
  return {
    id: data.id,
    status: data.status,
    videoUrl: data.video_url,
    posterUrl: data.poster_url,
    error: data.error,
    provider: "higgsfield",
  };
}
