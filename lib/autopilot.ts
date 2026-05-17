// Strive OS — Content Autopilot
//
// Hands-off pipeline. Runs on a cron. Every run:
//   1. Generates N fresh on-brand ideas (Claude).
//   2. Records each voiceover (ElevenLabs).
//   3. Spins up a hyper-realistic UGC creator video (Higgsfield).
//   4. Polls until the video is rendered.
//   5. Schedules each finished post into the GHL Social Planner on the
//      configured 2x/day cadence.
//
// Returns a manifest of what shipped. Designed to be idempotent per run —
// no shared state, no manual buttons.

import { generateIdeaFeed, isAnthropicConfigured, type Idea } from "@/lib/ai";
import { generateAudio, isElevenLabsConfigured } from "@/lib/elevenlabs";
import {
  isHiggsfieldConfigured,
  pollUGCVideo,
  startUGCVideo,
  type HiggsfieldJob,
} from "@/lib/higgsfield";
import {
  buildSchedule,
  isGHLConfigured,
  scheduleSocialPost,
} from "@/lib/ghl";

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

const CREATOR_STYLES = ["young-mom", "older-athlete", "soccer-dad", "teen-creator"] as const;
type CreatorStyle = (typeof CREATOR_STYLES)[number];

export type AutopilotConfig = {
  count?: number; // posts to produce this run
  waitForVideos?: boolean; // poll until rendered, or fire-and-forget
};

export type AutopilotRunResult = {
  startedAt: string;
  finishedAt: string;
  configured: {
    anthropic: boolean;
    elevenlabs: boolean;
    higgsfield: boolean;
    ghl: boolean;
  };
  produced: Array<{
    pillar: Idea["pillar"];
    hook: string;
    caption: string;
    creatorStyle: CreatorStyle;
    voiceover: { ok: boolean; error?: string };
    video: { ok: boolean; jobId?: string; status?: string; videoUrl?: string; error?: string };
    schedule: { ok: boolean; id?: string; scheduledFor?: string; error?: string };
  }>;
  totals: { ideas: number; scheduled: number; videoCompleted: number };
};

function pickStyle(i: number): CreatorStyle {
  return CREATOR_STYLES[i % CREATOR_STYLES.length];
}

async function waitForVideo(jobId: string): Promise<HiggsfieldJob> {
  const start = Date.now();
  // Cheap mock: if no real Higgsfield key, return placeholder.
  if (!isHiggsfieldConfigured() || jobId.startsWith("mock_")) {
    return { id: jobId, status: "completed", provider: "mock" };
  }
  let last: HiggsfieldJob = { id: jobId, status: "queued", provider: "higgsfield" };
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    last = await pollUGCVideo(jobId);
    if (last.status === "completed" || last.status === "failed") return last;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return last;
}

export async function runAutopilot(cfg: AutopilotConfig = {}): Promise<AutopilotRunResult> {
  const startedAt = new Date().toISOString();
  const count = Math.min(Math.max(cfg.count ?? 14, 1), 28); // up to 2 weeks
  const waitForVideos = cfg.waitForVideos ?? true;

  const ideas = await generateIdeaFeed(count);
  const slots = buildSchedule(ideas.length);
  const produced: AutopilotRunResult["produced"] = [];

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    const style = pickStyle(i);

    // 1) Voiceover
    let audioDataUri: string | undefined;
    let voiceover: AutopilotRunResult["produced"][number]["voiceover"] = { ok: false };
    try {
      if (isElevenLabsConfigured()) {
        const audio = await generateAudio(idea.voiceover);
        audioDataUri = audio.audioDataUri;
        voiceover = { ok: true };
      } else {
        voiceover = { ok: false, error: "elevenlabs_not_configured" };
      }
    } catch (err) {
      voiceover = { ok: false, error: err instanceof Error ? err.message : "voiceover_failed" };
    }

    // 2) UGC video
    let video: AutopilotRunResult["produced"][number]["video"] = { ok: false };
    let videoUrl: string | undefined;
    try {
      const job = await startUGCVideo({
        pitch: idea.creatorPitch,
        pillar: idea.pillar,
        creatorStyle: style,
        durationSec: 30,
        audioDataUri,
        productUrl: process.env.NEXT_PUBLIC_COURSE_URL,
      });
      if (waitForVideos) {
        const finished = await waitForVideo(job.id);
        videoUrl = finished.videoUrl;
        video = {
          ok: finished.status === "completed",
          jobId: finished.id,
          status: finished.status,
          videoUrl: finished.videoUrl,
          error: finished.error,
        };
      } else {
        video = { ok: true, jobId: job.id, status: job.status, videoUrl: job.videoUrl };
        videoUrl = job.videoUrl;
      }
    } catch (err) {
      video = { ok: false, error: err instanceof Error ? err.message : "video_failed" };
    }

    // 3) Schedule to GHL
    let schedule: AutopilotRunResult["produced"][number]["schedule"] = { ok: false };
    try {
      const r = await scheduleSocialPost({
        caption: idea.caption,
        mediaUrl: videoUrl,
        platform: "TikTok",
        scheduledFor: slots[i],
      });
      schedule = { ok: true, id: r.id, scheduledFor: r.scheduledFor };
    } catch (err) {
      schedule = {
        ok: false,
        scheduledFor: slots[i],
        error: err instanceof Error ? err.message : "schedule_failed",
      };
    }

    produced.push({
      pillar: idea.pillar,
      hook: idea.hook,
      caption: idea.caption,
      creatorStyle: style,
      voiceover,
      video,
      schedule,
    });
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    configured: {
      anthropic: isAnthropicConfigured(),
      elevenlabs: isElevenLabsConfigured(),
      higgsfield: isHiggsfieldConfigured(),
      ghl: isGHLConfigured(),
    },
    produced,
    totals: {
      ideas: produced.length,
      scheduled: produced.filter((p) => p.schedule.ok).length,
      videoCompleted: produced.filter((p) => p.video.ok).length,
    },
  };
}
