/**
 * GoHighLevel Social Planner client.
 *
 * GHL exposes a Social Media Posting API that can schedule posts across
 * connected channels (TikTok, IG, Facebook, YouTube, LinkedIn, etc.). To use
 * it, the TikTok account must be connected to your GHL Location via Social
 * Planner UI — once connected, GHL gives back a `socialAccountId` that we
 * reference at schedule time.
 *
 * Required env:
 *   GHL_API_KEY        — Private Integration token
 *   GHL_LOCATION_ID    — your Strive Soccer location
 *   GHL_TIKTOK_ACCOUNT_ID — the socialAccountId for your connected TikTok
 *
 * Docs: https://highlevel.stoplight.io/docs/integrations/ (Social Planner section)
 */

import type { ScheduledPost } from "./types";

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

export function isGhlSocialConfigured() {
  return Boolean(
    process.env.GHL_API_KEY &&
      process.env.GHL_LOCATION_ID &&
      process.env.GHL_TIKTOK_ACCOUNT_ID,
  );
}

export type SchedulePostInput = {
  caption: string;
  videoUrl: string;
  posterUrl?: string;
  scheduledFor: string; // ISO
  /** Defaults to the TikTok account from env. */
  socialAccountIds?: string[];
};

export type SchedulePostResult = {
  ok: boolean;
  ghlPostId?: string;
  scheduledFor: string;
  channel: "tiktok";
  mock?: boolean;
  error?: string;
};

export async function scheduleTikTokPost(
  input: SchedulePostInput,
): Promise<SchedulePostResult> {
  if (!isGhlSocialConfigured()) {
    return mockSchedule(input);
  }

  const accounts = input.socialAccountIds ?? [
    process.env.GHL_TIKTOK_ACCOUNT_ID!,
  ];

  // Real call — uncomment when wiring to your GHL account.
  //
  // const res = await fetch(`${GHL_BASE}/social-media-posting/${process.env.GHL_LOCATION_ID}/posts`, {
  //   method: "POST",
  //   headers: {
  //     Authorization: `Bearer ${process.env.GHL_API_KEY}`,
  //     "Content-Type": "application/json",
  //     Version: API_VERSION,
  //   },
  //   body: JSON.stringify({
  //     accountIds: accounts,
  //     summary: input.caption,
  //     media: [
  //       { url: input.videoUrl, type: "video", thumbnail: input.posterUrl },
  //     ],
  //     scheduleDate: input.scheduledFor,
  //     status: "scheduled",
  //   }),
  // });
  // if (!res.ok) {
  //   const body = await res.text().catch(() => "");
  //   return { ok: false, scheduledFor: input.scheduledFor, channel: "tiktok", error: `GHL ${res.status}: ${body}` };
  // }
  // const json = (await res.json()) as { id: string };
  // return { ok: true, ghlPostId: json.id, scheduledFor: input.scheduledFor, channel: "tiktok" };

  void GHL_BASE;
  void API_VERSION;
  void accounts;
  return mockSchedule(input);
}

function mockSchedule(input: SchedulePostInput): SchedulePostResult {
  return {
    ok: true,
    ghlPostId: `mock_${Date.now().toString(36)}`,
    scheduledFor: input.scheduledFor,
    channel: "tiktok",
    mock: true,
  };
}

/**
 * List connected social accounts on the GHL location. UI uses this to let
 * Yinka pick which TikTok identity to post from (he might add a second).
 */
export async function listSocialAccounts(): Promise<
  Array<{ id: string; platform: string; name: string }>
> {
  if (!isGhlSocialConfigured()) {
    return [
      { id: "mock_tiktok_strive", platform: "tiktok", name: "@strivesoccerfc" },
    ];
  }
  // const res = await fetch(`${GHL_BASE}/social-media-posting/${process.env.GHL_LOCATION_ID}/accounts`, {
  //   headers: {
  //     Authorization: `Bearer ${process.env.GHL_API_KEY}`,
  //     Version: API_VERSION,
  //   },
  // });
  // if (!res.ok) return [];
  // const json = await res.json();
  // return json.accounts.map((a) => ({ id: a.id, platform: a.platform, name: a.name }));
  return [];
}

// ============================================================================
// In-memory schedule store — replace with Supabase when wired.
// ============================================================================

const _store: ScheduledPost[] = [];

export function rememberScheduledPost(p: ScheduledPost) {
  _store.push(p);
}

export function listScheduledPosts(): ScheduledPost[] {
  return _store.slice();
}
