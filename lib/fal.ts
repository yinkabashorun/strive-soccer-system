// Fal.ai — text-to-video for Strive Soccer's UGC-style content.
//
// REST queue API: submit a job (POST), poll for status, fetch result when
// COMPLETED. Auth header is `Authorization: Key <FAL_KEY>`.
//
// Defaults to fal-ai/kling-video v1.6 standard text-to-video (vertical 9:16,
// strong action / sports footage). Override the model via FAL_MODEL.

const FAL_BASE = "https://queue.fal.run";
const DEFAULT_MODEL = "fal-ai/kling-video/v1.6/standard/text-to-video";

// The Strive Soccer house prompt. Used when no override is supplied — fal
// models are text-to-video (silent), so this describes the visual; the
// ElevenLabs voiceover is overlaid in post.
const DEFAULT_PROMPT =
  "a young male soccer player in a Strive Soccer jersey doing an advanced dribbling move on a professional pitch, cinematic close-up, golden hour lighting, UGC style vertical video 9:16";

export type FalJob = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  videoUrl?: string;
  posterUrl?: string;
  error?: string;
  provider: "fal" | "mock";
};

// Kept structurally compatible with the previous higgsfield request type so
// callers (autopilot, /api routes) didn't have to be re-typed end-to-end.
export type FalVideoRequest = {
  prompt?: string;
  pillar?: string;
  durationSec?: number;
  pitch?: string;
  creatorStyle?: string;
  audioDataUri?: string;
  productUrl?: string;
};

export function isFalConfigured() {
  return Boolean(process.env.FAL_KEY);
}

function model() {
  return process.env.FAL_MODEL || DEFAULT_MODEL;
}

function authHeaders() {
  return {
    Authorization: `Key ${process.env.FAL_KEY ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function buildPrompt(req: FalVideoRequest): string {
  return req.prompt?.trim() || DEFAULT_PROMPT;
}

function mapStatus(s: string | undefined): FalJob["status"] {
  switch (s) {
    case "IN_QUEUE":
      return "queued";
    case "IN_PROGRESS":
      return "processing";
    case "COMPLETED":
      return "completed";
    case "FAILED":
    case "ERROR":
      return "failed";
    default:
      return "processing";
  }
}

function mockJob(): FalJob {
  return {
    id: `mock_${Math.random().toString(36).slice(2, 10)}`,
    status: "queued",
    provider: "mock",
  };
}

export async function startUGCVideo(req: FalVideoRequest): Promise<FalJob> {
  if (!isFalConfigured()) return mockJob();

  const res = await fetch(`${FAL_BASE}/${model()}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      prompt: buildPrompt(req),
      duration: String(req.durationSec ?? 5),
      aspect_ratio: "9:16",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`fal_submit_${res.status}: ${detail.slice(0, 240)}`);
  }

  const data = (await res.json()) as {
    request_id?: string;
    status?: string;
    response_url?: string;
    status_url?: string;
  };
  if (!data.request_id) throw new Error("fal_submit: no request_id in response");

  return {
    id: data.request_id,
    status: mapStatus(data.status),
    provider: "fal",
  };
}

export async function pollUGCVideo(id: string): Promise<FalJob> {
  if (!isFalConfigured() || id.startsWith("mock_")) {
    return { id, status: "processing", provider: "mock" };
  }

  const statusRes = await fetch(
    `${FAL_BASE}/${model()}/requests/${id}/status`,
    { headers: authHeaders() },
  );
  if (!statusRes.ok) {
    const detail = await statusRes.text().catch(() => "");
    throw new Error(`fal_status_${statusRes.status}: ${detail.slice(0, 240)}`);
  }
  const statusData = (await statusRes.json()) as { status?: string };
  const mapped = mapStatus(statusData.status);
  if (mapped !== "completed") {
    return { id, status: mapped, provider: "fal" };
  }

  const resultRes = await fetch(`${FAL_BASE}/${model()}/requests/${id}`, {
    headers: authHeaders(),
  });
  if (!resultRes.ok) {
    const detail = await resultRes.text().catch(() => "");
    throw new Error(`fal_result_${resultRes.status}: ${detail.slice(0, 240)}`);
  }
  const result = (await resultRes.json()) as {
    video?: { url?: string };
    output?: { video?: { url?: string } };
    error?: string;
  };
  const videoUrl =
    result.video?.url ??
    result.output?.video?.url ??
    undefined;

  return {
    id,
    status: videoUrl ? "completed" : "failed",
    videoUrl,
    error: result.error,
    provider: "fal",
  };
}
