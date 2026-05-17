// GoHighLevel integration surface.
//
// Social Planner post scheduling (2x/day cadence)

export type GHLEvent =
  | "contact.created"
  | "contact.updated"
  | "opportunity.stage_changed"
  | "payment.received"
  | "appointment.booked";

export type GHLContactPayload = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
};

export function ghlContactToLead(c: GHLContactPayload) {
  const sourceMap: Record<string, "TikTok" | "Instagram" | "Referral" | "Website" | "GHL Form"> = {
    tiktok: "TikTok",
    instagram: "Instagram",
    referral: "Referral",
    website: "Website",
  };
  const tag = (c.tags ?? []).find((t) => sourceMap[t.toLowerCase()]);
  return {
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Unknown",
    source: (tag && sourceMap[tag.toLowerCase()]) ?? "GHL Form",
    interest: "Group Training" as const,
    createdAt: new Date().toISOString(),
    status: "New" as const,
  };
}

export async function pushToGHL(event: GHLEvent, payload: unknown) {
  const url = process.env.GHL_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GHL_API_KEY ?? ""}`,
    },
    body: JSON.stringify({ event, payload }),
  });
}

export function isGHLConfigured() {
  return Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

// --- Social Planner ---------------------------------------------------------

const GHL_BASE = "https://services.leadconnectorhq.com";

// Verified full compound account IDs for Strive Soccer GHL location
// Format: oauthId_locationId_originId[_type]
const ACCOUNTS = {
  // Facebook page (accepts text-only posts)
  facebook: "69b35261e0bf05fafcdd7ba9_SjVsI2ZXLXjBrWGA0VfI_715752011620505_page",
  // Instagram profile (requires image or video)
  instagram: "69b34fb7529ec10b6f02e928_SjVsI2ZXLXjBrWGA0VfI_17841460768055115",
  // TikTok business (requires video)
  tiktok: "69b351a99b61dd3500b9719e_SjVsI2ZXLXjBrWGA0VfI_000gqYzyKZDg205Jz1M7omQrc03h3wkGxp_business",
};

export type SocialPostInput = {
  caption: string;
  mediaUrl?: string;
  platform?: "TikTok" | "Instagram" | "Facebook";
  scheduledFor: string; // ISO
};

export type SocialPostResult = {
  id: string;
  scheduledFor: string;
  platform: string;
  status: "scheduled" | "queued-mock";
};

export function dailySlots(): [string, string] {
  const raw = (process.env.GHL_DAILY_SLOTS ?? "11:00,19:00").split(",");
  const a = raw[0]?.trim() || "11:00";
  const b = raw[1]?.trim() || "19:00";
  return [a, b];
}

// Build N upcoming slot times (ISO) starting tomorrow morning, two per day.
export function buildSchedule(count: number, fromDate = new Date()): string[] {
  const [aHm, bHm] = dailySlots();
  const [ah, am] = aHm.split(":").map((n) => parseInt(n, 10));
  const [bh, bm] = bHm.split(":").map((n) => parseInt(n, 10));
  const out: string[] = [];
  const day = new Date(fromDate);
  day.setDate(day.getDate() + 1);
  day.setHours(0, 0, 0, 0);
  while (out.length < count) {
    const s1 = new Date(day);
    s1.setHours(ah, am || 0, 0, 0);
    const s2 = new Date(day);
    s2.setHours(bh, bm || 0, 0, 0);
    out.push(s1.toISOString());
    if (out.length < count) out.push(s2.toISOString());
    day.setDate(day.getDate() + 1);
  }
  return out;
}

export async function scheduleSocialPost(post: SocialPostInput): Promise<SocialPostResult> {
  if (!isGHLConfigured()) {
    return {
      id: `mock_post_${Math.random().toString(36).slice(2, 10)}`,
      scheduledFor: post.scheduledFor,
      platform: post.platform ?? "Facebook",
      status: "queued-mock",
    };
  }

  const locationId = process.env.GHL_LOCATION_ID!;
  const userId = process.env.GHL_USER_ID || ACCOUNTS.tiktok.split("_")[0];

  // Choose accounts based on available media:
  // - Facebook page accepts text-only posts
  // - Instagram + TikTok require media (video/image)
  const hasMedia = Boolean(post.mediaUrl);
  const accountIds = hasMedia
    ? [ACCOUNTS.facebook, ACCOUNTS.instagram, ACCOUNTS.tiktok]
    : [ACCOUNTS.facebook]; // text-only: Facebook only

  const media: Array<{ url: string; type: string }> = post.mediaUrl
    ? [{ url: post.mediaUrl, type: "video" }]
    : [];

  const body: Record<string, unknown> = {
    type: "post",
    accountIds,
    summary: post.caption,
    scheduleDate: post.scheduledFor,
    status: "scheduled",
    userId,
    media,
  };

  const res = await fetch(`${GHL_BASE}/social-media-posting/${locationId}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ghl_schedule_${res.status}: ${detail.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    results?: { post?: { _id?: string; id?: string } };
    id?: string;
    _id?: string;
  };
  const id =
    data.results?.post?._id ??
    data.results?.post?.id ??
    data.id ??
    data._id ??
    `ghl_${Math.random().toString(36).slice(2, 10)}`;

  return {
    id,
    scheduledFor: post.scheduledFor,
    platform: hasMedia ? "TikTok" : "Facebook",
    status: "scheduled",
  };
      }
