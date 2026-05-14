/**
 * GoHighLevel Social Planner client.
 *
 * Required env:
 *   GHL_API_KEY               — Private Integration token
 *   GHL_LOCATION_ID           — your Strive Soccer location id
 *   GHL_TIKTOK_ACCOUNT_ID     — connected TikTok identity (Social Planner)
 *
 * When any of those are missing, every call returns a mock success so the UI
 * flow is end-to-end testable without credentials.
 */

import type { AdPillar, ScheduledPost } from "./types";
import { logProvider } from "./store";

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
  statusCode?: number;
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

  const url = `${GHL_BASE}/social-media-posting/${process.env.GHL_LOCATION_ID}/posts`;
  const body = {
    accountIds: accounts,
    summary: input.caption,
    media: [
      {
        url: input.videoUrl,
        type: "video" as const,
        thumbnail: input.posterUrl,
      },
    ],
    scheduleDate: input.scheduledFor,
    status: "scheduled" as const,
  };

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        "Content-Type": "application/json",
        Version: API_VERSION,
      },
      body: JSON.stringify(body),
    });

    const durationMs = Date.now() - start;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      await logProvider({
        provider: "ghl",
        action: "schedule_tiktok",
        ok: false,
        statusCode: res.status,
        durationMs,
        payload: body,
        error: text.slice(0, 500),
      });
      return {
        ok: false,
        scheduledFor: input.scheduledFor,
        channel: "tiktok",
        statusCode: res.status,
        error: friendlyGhlError(res.status, text),
      };
    }

    const json = (await res.json()) as { id?: string; postId?: string };
    const postId = json.id ?? json.postId;
    await logProvider({
      provider: "ghl",
      action: "schedule_tiktok",
      ok: true,
      statusCode: res.status,
      durationMs,
      payload: { ghlPostId: postId },
    });
    return {
      ok: true,
      ghlPostId: postId,
      scheduledFor: input.scheduledFor,
      channel: "tiktok",
    };
  } catch (e) {
    await logProvider({
      provider: "ghl",
      action: "schedule_tiktok",
      ok: false,
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      ok: false,
      scheduledFor: input.scheduledFor,
      channel: "tiktok",
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

function friendlyGhlError(status: number, body: string): string {
  if (status === 401) {
    return "GHL rejected the API key. Check GHL_API_KEY in .env.local — must be a Private Integration token.";
  }
  if (status === 403) {
    return "GHL says forbidden. The Private Integration needs Social Planner write scope. Re-issue the token with the right scope.";
  }
  if (status === 404) {
    return `GHL says not found — check GHL_LOCATION_ID (${process.env.GHL_LOCATION_ID}).`;
  }
  if (status === 422) {
    return `GHL rejected the payload. Common cause: socialAccountId mismatch. Check GHL_TIKTOK_ACCOUNT_ID. Body: ${body.slice(0, 200)}`;
  }
  return `GHL ${status}: ${body.slice(0, 200)}`;
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

  const start = Date.now();
  try {
    const res = await fetch(
      `${GHL_BASE}/social-media-posting/${process.env.GHL_LOCATION_ID}/accounts`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GHL_API_KEY}`,
          Version: API_VERSION,
        },
      },
    );

    if (!res.ok) {
      await logProvider({
        provider: "ghl",
        action: "list_accounts",
        ok: false,
        statusCode: res.status,
        durationMs: Date.now() - start,
      });
      return [];
    }
    const json = (await res.json()) as {
      accounts?: Array<{ id: string; platform: string; name: string }>;
    };
    return json.accounts ?? [];
  } catch {
    return [];
  }
}

/**
 * Cancel/delete a scheduled GHL post.
 */
export async function cancelScheduledPost(ghlPostId: string): Promise<boolean> {
  if (!isGhlSocialConfigured()) return true;
  try {
    const res = await fetch(
      `${GHL_BASE}/social-media-posting/${process.env.GHL_LOCATION_ID}/posts/${ghlPostId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${process.env.GHL_API_KEY}`,
          Version: API_VERSION,
        },
      },
    );
    return res.ok;
  } catch {
    return false;
  }
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
// Demo seed — deterministic 7-day queue so older /studio UI isn't empty before
// the cron has actually scheduled anything. The real queue lives in
// lib/store.ts now; this is kept for backward compatibility with components
// already importing it.
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
  const d = new Date(TODAY_REF);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  d.setUTCHours(13, 0, 0, 0);
  return d.toISOString();
}

export function seedScheduledQueue(): QueueRow[] {
  return SEED_HOOKS.map((h, i) => {
    const offset = i - 3;
    const scheduledFor = morningSlot(offset);
    const status: ScheduledPost["status"] = offset < 0 ? "posted" : "pending";
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
