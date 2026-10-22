// Strive OS — Content Autopilot
//
// Generates N ideas, submits all video jobs to Fal.ai in parallel, then
// waits (with a global deadline) for each render to finish. Each post is
// scheduled to GoHighLevel ONLY once its video URL is known, so GHL
// always receives a media-attached post when Fal succeeds.
//
// Sizing:
//   Vercel cron functions are capped at 300s. We reserve the last ~30s
//   for GHL scheduling and use the rest as the video deadline. With
//   kling-video v1.6 standard most renders finish in 60–120s.
//
// Fallback:
//   If a video misses the deadline (or Fal fails outright), we still
//   schedule the post — but for Facebook only and with no media, so the
//   caption goes out rather than the slot being wasted.

import { generateIdeaFeed, isAnthropicConfigured, type Idea } from "@/lib/ai";
import { generateAudio, isElevenLabsConfigured } from "@/lib/elevenlabs";
import {
  isFalConfigured,
  pollUGCVideo,
  startUGCVideo,
  type FalJob,
} from "@/lib/fal";
import { buildSchedule, isGHLConfigured, scheduleSocialPost } from "@/lib/ghl";

const CREATOR_STYLES = ["young-mom", "older-athlete", "soccer-dad", "teen-creator"] as const;
type CreatorStyle = (typeof CREATOR_STYLES)[number];

// Total budget per run. Vercel cap is 300s; we leave a buffer for the
// final GHL scheduling pass.
const VIDEO_DEADLINE_MS = 240 * 1000;
const POLL_INTERVAL_MS = 5000;

export type AutopilotConfig = {
  count?: number;
};

type ProducedRow = {
  pillar: Idea["pillar"];
  hook: string;
  caption: string;
  creatorStyle: CreatorStyle;
  voiceover: { ok: boolean; error?: string };
  video: { ok: boolean; jobId?: string; status?: string; videoUrl?: string; error?: string };
  schedule: { ok: boolean; id?: string; scheduledFor?: string; error?: string };
};

export type AutopilotRunResult = {
  startedAt: string;
  finishedAt: string;
  configured: {
    anthropic: boolean;
    elevenlabs: boolean;
    fal: boolean;
    ghl: boolean;
  };
  produced: ProducedRow[];
  totals: { ideas: number; scheduled: number; videoCompleted: number; videoTimeout: number };
};

type WorkItem = {
  idea: Idea;
  style: CreatorStyle;
  audioOk: boolean;
  audioError?: string;
  job?: FalJob;
  videoUrl?: string;
  videoStatus: "queued" | "processing" | "completed" | "failed" | "timeout" | "not_submitted";
  videoError?: string;
  scheduledFor: string;
  schedule: ProducedRow["schedule"];
};

function pickStyle(i: number): CreatorStyle {
  return CREATOR_STYLES[i % CREATOR_STYLES.length];
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function submitOne(
  idea: Idea,
  style: CreatorStyle,
  audioDataUri: string | undefined,
): Promise<{ job?: FalJob; error?: string }> {
  try {
    const job = await startUGCVideo({
      pitch: idea.creatorPitch,
      pillar: idea.pillar,
      creatorStyle: style,
      durationSec: 5,
      audioDataUri,
      productUrl: process.env.NEXT_PUBLIC_COURSE_URL,
    });
    return { job };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "video_submit_failed" };
  }
}

async function pollUntilDeadline(items: WorkItem[], deadline: number) {
  const inFlight = () =>
    items.filter(
      (w) => w.job && (w.videoStatus === "queued" || w.videoStatus === "processing"),
    );

  while (inFlight().length > 0 && Date.now() < deadline) {
    await Promise.all(
      inFlight().map(async (w) => {
        if (!w.job) return;
        try {
          const polled = await pollUGCVideo(w.job.id);
          w.videoStatus = polled.status;
          if (polled.videoUrl) w.videoUrl = polled.videoUrl;
          if (polled.error) w.videoError = polled.error;
        } catch (err) {
          // transient — keep trying next loop, but record the latest reason
          w.videoError = err instanceof Error ? err.message : "poll_failed";
        }
      }),
    );
    if (inFlight().length === 0) break;
    if (Date.now() + POLL_INTERVAL_MS >= deadline) break;
    await sleep(POLL_INTERVAL_MS);
  }

  // Anything still pending past the deadline is a timeout.
  for (const w of items) {
    if (w.videoStatus === "queued" || w.videoStatus === "processing") {
      w.videoStatus = "timeout";
    }
  }
}

async function scheduleOne(w: WorkItem) {
  try {
    const r = await scheduleSocialPost({
      caption: w.idea.caption,
      mediaUrl: w.videoUrl, // undefined → caption-only post (Facebook)
      platform: "TikTok",
      scheduledFor: w.scheduledFor,
    });
    w.schedule = { ok: true, id: r.id, scheduledFor: r.scheduledFor };
  } catch (err) {
    w.schedule = {
      ok: false,
      scheduledFor: w.scheduledFor,
      error: err instanceof Error ? err.message : "schedule_failed",
    };
  }
}

export async function runAutopilot(cfg: AutopilotConfig = {}): Promise<AutopilotRunResult> {
  const startedAt = new Date().toISOString();
  const count = Math.min(Math.max(cfg.count ?? 14, 1), 28);

  const ideas = await generateIdeaFeed(count);
  const slots = buildSchedule(ideas.length);

  // Phase 1: voiceover + video submission (parallel per item).
  const items: WorkItem[] = await Promise.all(
    ideas.map(async (idea, i) => {
      const style = pickStyle(i);

      let audioDataUri: string | undefined;
      let audioOk = false;
      let audioError: string | undefined;
      if (isElevenLabsConfigured()) {
        try {
          const audio = await generateAudio(idea.voiceover);
          audioDataUri = audio.audioDataUri;
          audioOk = true;
        } catch (err) {
          audioError = err instanceof Error ? err.message : "voiceover_failed";
        }
      } else {
        audioError = "elevenlabs_not_configured";
      }

      const { job, error: submitErr } = await submitOne(idea, style, audioDataUri);

      const w: WorkItem = {
        idea,
        style,
        audioOk,
        audioError,
        job,
        videoUrl: job?.videoUrl,
        videoStatus: job ? job.status : "not_submitted",
        videoError: submitErr,
        scheduledFor: slots[i],
        schedule: { ok: false },
      };
      return w;
    }),
  );

  // Phase 2: poll until every job is done or our deadline elapses.
  const deadline = Date.now() + VIDEO_DEADLINE_MS;
  if (items.some((w) => w.job)) {
    await pollUntilDeadline(items, deadline);
  }

  // Phase 3: schedule everything. Posts with a videoUrl go to all three
  // social accounts; posts without media fall back to Facebook caption-only.
  await Promise.all(items.map((w) => scheduleOne(w)));

  const produced: ProducedRow[] = items.map((w) => ({
    pillar: w.idea.pillar,
    hook: w.idea.hook,
    caption: w.idea.caption,
    creatorStyle: w.style,
    voiceover: { ok: w.audioOk, error: w.audioError },
    video: {
      ok: w.videoStatus === "completed",
      jobId: w.job?.id,
      status: w.videoStatus,
      videoUrl: w.videoUrl,
      error: w.videoError,
    },
    schedule: w.schedule,
  }));

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    configured: {
      anthropic: isAnthropicConfigured(),
      elevenlabs: isElevenLabsConfigured(),
      fal: isFalConfigured(),
      ghl: isGHLConfigured(),
    },
    produced,
    totals: {
      ideas: produced.length,
      scheduled: produced.filter((p) => p.schedule.ok).length,
      videoCompleted: produced.filter((p) => p.video.ok).length,
      videoTimeout: produced.filter((p) => p.video.status === "timeout").length,
    },
  };
}
