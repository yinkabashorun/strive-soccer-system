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

import type { AdPillar, ScheduledPost } from "./types";

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

// ============================================================================
// Demo seed — deterministic 7-day queue so the UI isn't empty before the cron
// has actually scheduled anything. Drop when Supabase is wired.
// ============================================================================

export type QueueRow = {
  id: string;
  scheduledFor: string;
  hook: string;
  pillar: AdPillar;
  caption: string;
  viralityScore: number;
  status: ScheduledPost["status"];
  platform: ScheduledPost["platform"];
  ghlPostId?: string;
};

const SEED_HOOKS: Array<{ pillar: AdPillar; hook: string; caption: string; v: number }> = [
  {
    pillar: "Ball Mastery",
    hook: "3 touches most kids skip — and why they freeze under pressure.",
    caption:
      "Master the basics or get exposed. #ballmastery #soccertraining #youthsoccer",
    v: 84,
  },
  {
    pillar: "Player Spotlight",
    hook: "She's 13. Watch how she sets this up.",
    caption: "Composure is taught. Creativity is unlocked. #playerspotlight",
    v: 78,
  },
  {
    pillar: "Mindset",
    hook: "The fastest player isn't the one running the most.",
    caption: "Composure > chaos. #footballiq #strivesoccer",
    v: 72,
  },
  {
    pillar: "Offer",
    hook: "Summer 2026: 60 spots. We're at 20.",
    caption: "Development Pack · 10 sessions · $319. #strivesoccer",
    v: 81,
  },
  {
    pillar: "Education",
    hook: "5 minutes a day for 30 days. Results no parent will believe.",
    caption: "The 5-minute touch plan. #soccerdrills #youthdevelopment",
    v: 69,
  },
  {
    pillar: "Behind the Scenes",
    hook: "This is what real training looks like.",
    caption: "No cone-tapping. Real reps under real pressure. #strivesoccer",
    v: 67,
  },
  {
    pillar: "Ball Mastery",
    hook: "200 touches a day. 30 days. Watch what happens.",
    caption: "The wall drill that builds pros. #ballmastery",
    v: 75,
  },
];

const TODAY_REF = new Date("2026-05-14T18:00:00Z");

function morningSlot(daysFromToday: number) {
  // 9am ET = 13:00 UTC during DST.
  const d = new Date(TODAY_REF);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  d.setUTCHours(13, 0, 0, 0);
  return d.toISOString();
}

/**
 * Returns a deterministic 7-day window (3 past, today, 4 upcoming) so the
 * Scheduled Queue UI has content out of the box.
 */
export function seedScheduledQueue(): QueueRow[] {
  return SEED_HOOKS.map((h, i) => {
    const offset = i - 3; // -3..+3
    const scheduledFor = morningSlot(offset);
    const status: ScheduledPost["status"] =
      offset < 0 ? "posted" : "pending";
    return {
      id: `seed_${i}`,
      scheduledFor,
      hook: h.hook,
      pillar: h.pillar,
      caption: h.caption,
      viralityScore: h.v,
      status,
      platform: "TikTok" as const,
      ghlPostId: offset < 0 ? `ghl_mock_${i}` : undefined,
    };
  }).sort(
    (a, b) =>
      new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
  );
}
