/**
 * Persistence layer.
 *
 *   - When Supabase is configured (NEXT_PUBLIC_SUPABASE_URL + SERVICE_ROLE key),
 *     reads/writes hit the `posts`, `config`, `provider_log` tables.
 *   - When not configured (e.g. local dev with no .env.local), falls back to
 *     an in-memory store seeded with example posts so the UI works.
 *
 * All callers MUST be server-side (route handlers, server components). The
 * service role key never reaches the browser.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AdAsset, AdGoal, AdPillar } from "./types";
import { BRAND } from "./ai-content";

// ============================================================================
// Domain types
// ============================================================================

export type PostStatus =
  | "queued"
  | "rendering"
  | "awaiting_video"
  | "awaiting_approval"
  | "approved"
  | "scheduled"
  | "posted"
  | "rejected"
  | "failed";

export type StoredPost = {
  id: string;
  hook: string;
  script: string;
  caption: string;
  cta: string;
  idea: string | null;
  pillar: AdPillar;
  goal: AdGoal;
  platform: "TikTok" | "Instagram" | "YouTube Shorts";

  videoPrompt: string;
  /** Full Claude.ai prompt block including Higgsfield avatar/webproduct/mode params. */
  higgsfieldPrompt: string | null;
  voiceoverScript: string;
  videoUrl: string | null;
  voiceUrl: string | null;
  posterUrl: string | null;
  durationSec: number;

  videoModel: string;
  voiceModel: string;

  viralityScore: number | null;
  viralityNotes: string | null;

  status: PostStatus;
  scheduledFor: string | null;
  postedAt: string | null;
  ghlPostId: string | null;

  rejectReason: string | null;
  generatedBy: "studio" | "cron" | "regenerate";

  createdAt: string;
  updatedAt: string;
};

export type OperatorConfig = {
  postTimeLocal: string; // "09:00"
  postTimezone: string; // "America/New_York"
  postDays: string[]; // ["mon","tue",...]
  pillarRotation: AdPillar[]; // length 7, Sun..Sat
  goalRotation: AdGoal[]; // length 7, Sun..Sat
  ctaLeadGen: string;
  ctaBrand: string;
  ctaCourse: string;
  ctaCamp: string;
  ctaBooking: string;
  autoApprove: boolean;
  // Higgsfield Marketing Studio defaults — used to compose the Claude.ai
  // prompt the operator pastes to render today's video.
  higgsfieldAvatarId: string;
  higgsfieldAvatarName: string;
  higgsfieldAvatarType: "preset" | "custom";
  higgsfieldWebproductId: string;
  higgsfieldWebproductUrl: string;
  higgsfieldMode: string; // "UGC" | "Tutorial" | "Product Review" | ...
  higgsfieldDurationSec: number;
  updatedAt: string;
};

export type ProviderLogRow = {
  provider: "anthropic" | "higgsfield" | "elevenlabs" | "ghl";
  action: string;
  ok: boolean;
  statusCode?: number;
  durationMs?: number;
  payload?: unknown;
  error?: string;
};

// ============================================================================
// Supabase client (server-side, service role)
// ============================================================================

let _server: SupabaseClient | null = null;

export function isStoreLive() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function server(): SupabaseClient {
  if (_server) return _server;
  _server = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  return _server;
}

// ============================================================================
// In-memory fallback (seeded)
// ============================================================================

const _memPosts: StoredPost[] = seedMemoryPosts();
let _memConfig: OperatorConfig = defaultConfig();

function defaultConfig(): OperatorConfig {
  return {
    postTimeLocal: "09:00",
    postTimezone: "America/New_York",
    postDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    pillarRotation: [
      "Ball Mastery",
      "Ball Mastery",
      "Player Spotlight",
      "Mindset",
      "Offer",
      "Education",
      "Behind the Scenes",
    ],
    goalRotation: [
      "Brand",
      "Lead-gen",
      "Lead-gen",
      "Lead-gen",
      "Lead-gen",
      "Lead-gen",
      "Course",
    ],
    ctaLeadGen: BRAND.ctas["Lead-gen"],
    ctaBrand: BRAND.ctas.Brand,
    ctaCourse: BRAND.ctas.Course,
    ctaCamp: BRAND.ctas.Camp,
    ctaBooking: BRAND.ctas.Booking,
    autoApprove: false,
    higgsfieldAvatarId: "94950cff-b90a-4416-8384-ce554ff387e1",
    higgsfieldAvatarName: "Malik",
    higgsfieldAvatarType: "preset",
    higgsfieldWebproductId: "61d71e62-5acf-41d7-85b6-58798582d1d6",
    higgsfieldWebproductUrl: "https://totalballmastery.netlify.app",
    higgsfieldMode: "UGC",
    higgsfieldDurationSec: 15,
    updatedAt: new Date().toISOString(),
  };
}

function seedMemoryPosts(): StoredPost[] {
  const SEED: Array<{
    pillar: AdPillar;
    goal: AdGoal;
    hook: string;
    caption: string;
    v: number;
    offsetDays: number;
    status: PostStatus;
  }> = [
    {
      pillar: "Ball Mastery",
      goal: "Lead-gen",
      hook: "3 touches most kids skip — and why they freeze under pressure.",
      caption:
        "Master the basics or get exposed. #ballmastery #soccertraining #youthsoccer",
      v: 84,
      offsetDays: -3,
      status: "posted",
    },
    {
      pillar: "Player Spotlight",
      goal: "Lead-gen",
      hook: "She's 13. Watch how she sets this up.",
      caption: "Composure is taught. Creativity is unlocked. #playerspotlight",
      v: 78,
      offsetDays: -2,
      status: "posted",
    },
    {
      pillar: "Mindset",
      goal: "Lead-gen",
      hook: "The fastest player isn't the one running the most.",
      caption: "Composure > chaos. #footballiq #strivesoccer",
      v: 72,
      offsetDays: -1,
      status: "posted",
    },
    {
      pillar: "Offer",
      goal: "Lead-gen",
      hook: "Summer 2026: 60 spots. We're at 20.",
      caption: "Development Pack · 10 sessions · $319. #strivesoccer",
      v: 81,
      offsetDays: 0,
      status: "awaiting_approval",
    },
    {
      pillar: "Education",
      goal: "Lead-gen",
      hook: "5 minutes a day for 30 days. Results no parent will believe.",
      caption: "The 5-minute touch plan. #soccerdrills #youthdevelopment",
      v: 69,
      offsetDays: 1,
      status: "awaiting_approval",
    },
    {
      pillar: "Behind the Scenes",
      goal: "Course",
      hook: "This is what real training looks like.",
      caption: "No cone-tapping. Real reps under real pressure. #strivesoccer",
      v: 67,
      offsetDays: 2,
      status: "scheduled",
    },
    {
      pillar: "Ball Mastery",
      goal: "Lead-gen",
      hook: "200 touches a day. 30 days. Watch what happens.",
      caption: "The wall drill that builds pros. #ballmastery",
      v: 75,
      offsetDays: 3,
      status: "scheduled",
    },
  ];

  return SEED.map((s, i) => {
    const ref = new Date("2026-05-14T13:00:00Z");
    ref.setUTCDate(ref.getUTCDate() + s.offsetDays);
    const iso = ref.toISOString();
    return {
      id: `seed_${i}`,
      hook: s.hook,
      script: `[0–2s] "${s.hook}" [2–30s] body + CTA.`,
      caption: s.caption,
      cta: BRAND.ctas[s.goal],
      idea: null,
      pillar: s.pillar,
      goal: s.goal,
      platform: "TikTok",
      videoPrompt: `Cinematic 9:16 ad. ${s.pillar} pillar.`,
      higgsfieldPrompt: null,
      voiceoverScript: s.hook,
      videoUrl: `https://placehold.co/720x1280/0f0f10/E5FF3D/mp4?seed=${i}`,
      voiceUrl: `https://placehold.co/audio/mp3?seed=${i}`,
      posterUrl: `https://placehold.co/720x1280/0f0f10/E5FF3D/png?seed=${i}`,
      durationSec: 28,
      videoModel: "higgsfield/v1-fast",
      voiceModel: "elevenlabs/eleven_turbo_v2_5",
      viralityScore: s.v,
      viralityNotes: null,
      status: s.status,
      scheduledFor: iso,
      postedAt: s.status === "posted" ? iso : null,
      ghlPostId: s.status === "posted" ? `ghl_mock_${i}` : null,
      rejectReason: null,
      generatedBy: "cron",
      createdAt: new Date(
        new Date(iso).getTime() - 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: iso,
    };
  });
}

// ============================================================================
// Post CRUD
// ============================================================================

const COLS = `id, hook, script, caption, cta, idea, pillar, goal, platform,
  video_prompt, higgsfield_prompt, voiceover_script, video_url, voice_url, poster_url, duration_sec,
  video_model, voice_model, virality_score, virality_notes, status,
  scheduled_for, posted_at, ghl_post_id, reject_reason, generated_by,
  created_at, updated_at`;

function rowToPost(r: Record<string, unknown>): StoredPost {
  return {
    id: r.id as string,
    hook: r.hook as string,
    script: r.script as string,
    caption: r.caption as string,
    cta: r.cta as string,
    idea: (r.idea as string) ?? null,
    pillar: r.pillar as AdPillar,
    goal: r.goal as AdGoal,
    platform: r.platform as StoredPost["platform"],
    videoPrompt: r.video_prompt as string,
    higgsfieldPrompt: (r.higgsfield_prompt as string) ?? null,
    voiceoverScript: r.voiceover_script as string,
    videoUrl: (r.video_url as string) ?? null,
    voiceUrl: (r.voice_url as string) ?? null,
    posterUrl: (r.poster_url as string) ?? null,
    durationSec: (r.duration_sec as number) ?? 28,
    videoModel: (r.video_model as string) ?? "higgsfield/v1-fast",
    voiceModel: (r.voice_model as string) ?? "elevenlabs/eleven_turbo_v2_5",
    viralityScore: (r.virality_score as number) ?? null,
    viralityNotes: (r.virality_notes as string) ?? null,
    status: r.status as PostStatus,
    scheduledFor: (r.scheduled_for as string) ?? null,
    postedAt: (r.posted_at as string) ?? null,
    ghlPostId: (r.ghl_post_id as string) ?? null,
    rejectReason: (r.reject_reason as string) ?? null,
    generatedBy: (r.generated_by as StoredPost["generatedBy"]) ?? "studio",
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function postToRow(p: StoredPost): Record<string, unknown> {
  return {
    id: p.id,
    hook: p.hook,
    script: p.script,
    caption: p.caption,
    cta: p.cta,
    idea: p.idea,
    pillar: p.pillar,
    goal: p.goal,
    platform: p.platform,
    video_prompt: p.videoPrompt,
    higgsfield_prompt: p.higgsfieldPrompt,
    voiceover_script: p.voiceoverScript,
    video_url: p.videoUrl,
    voice_url: p.voiceUrl,
    poster_url: p.posterUrl,
    duration_sec: p.durationSec,
    video_model: p.videoModel,
    voice_model: p.voiceModel,
    virality_score: p.viralityScore,
    virality_notes: p.viralityNotes,
    status: p.status,
    scheduled_for: p.scheduledFor,
    posted_at: p.postedAt,
    ghl_post_id: p.ghlPostId,
    reject_reason: p.rejectReason,
    generated_by: p.generatedBy,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function adAssetToPost(
  asset: AdAsset,
  opts: {
    generatedBy?: StoredPost["generatedBy"];
    status?: PostStatus;
    higgsfieldPrompt?: string;
  } = {},
): StoredPost {
  const now = new Date().toISOString();
  return {
    id: asset.id,
    hook: asset.hook,
    script: asset.script,
    caption: asset.caption,
    cta: asset.cta,
    idea: asset.idea || null,
    pillar: asset.pillar,
    goal: asset.goal,
    platform: asset.platform,
    videoPrompt: asset.videoPrompt,
    higgsfieldPrompt: opts.higgsfieldPrompt ?? null,
    voiceoverScript: asset.voiceoverScript,
    videoUrl: asset.videoUrl ?? null,
    voiceUrl: asset.voiceUrl ?? null,
    posterUrl: asset.posterUrl ?? null,
    durationSec: asset.durationSec,
    videoModel: asset.videoModel,
    voiceModel: asset.voiceoverModel,
    viralityScore: asset.viralityScore ?? null,
    viralityNotes: asset.viralityNotes ?? null,
    status: opts.status ?? "awaiting_approval",
    scheduledFor: asset.scheduledFor ?? null,
    postedAt: asset.postedAt ?? null,
    ghlPostId: asset.ghlPostId ?? null,
    rejectReason: null,
    generatedBy: opts.generatedBy ?? "studio",
    createdAt: asset.createdAt ?? now,
    updatedAt: now,
  };
}

export async function savePost(p: StoredPost): Promise<StoredPost> {
  if (!isStoreLive()) {
    const idx = _memPosts.findIndex((x) => x.id === p.id);
    if (idx >= 0) _memPosts[idx] = p;
    else _memPosts.push(p);
    return p;
  }
  const { error } = await server()
    .from("posts")
    .upsert(postToRow(p), { onConflict: "id" });
  if (error) throw new Error(`Supabase savePost: ${error.message}`);
  return p;
}

export async function getPost(id: string): Promise<StoredPost | null> {
  if (!isStoreLive()) {
    return _memPosts.find((p) => p.id === id) ?? null;
  }
  const { data, error } = await server()
    .from("posts")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Supabase getPost: ${error.message}`);
  return data ? rowToPost(data as Record<string, unknown>) : null;
}

export async function listPosts(filter?: {
  status?: PostStatus | PostStatus[];
  from?: string;
  to?: string;
  limit?: number;
}): Promise<StoredPost[]> {
  if (!isStoreLive()) {
    let rows = _memPosts.slice();
    if (filter?.status) {
      const list = Array.isArray(filter.status) ? filter.status : [filter.status];
      rows = rows.filter((p) => list.includes(p.status));
    }
    if (filter?.from) {
      rows = rows.filter((p) => (p.scheduledFor ?? p.createdAt) >= filter.from!);
    }
    if (filter?.to) {
      rows = rows.filter((p) => (p.scheduledFor ?? p.createdAt) <= filter.to!);
    }
    rows.sort((a, b) => {
      const ax = a.scheduledFor ?? a.createdAt;
      const bx = b.scheduledFor ?? b.createdAt;
      return ax.localeCompare(bx);
    });
    return filter?.limit ? rows.slice(0, filter.limit) : rows;
  }
  let q = server()
    .from("posts")
    .select(COLS)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filter?.status) {
    const list = Array.isArray(filter.status) ? filter.status : [filter.status];
    q = q.in("status", list);
  }
  if (filter?.from) q = q.gte("scheduled_for", filter.from);
  if (filter?.to) q = q.lte("scheduled_for", filter.to);
  if (filter?.limit) q = q.limit(filter.limit);

  const { data, error } = await q;
  if (error) throw new Error(`Supabase listPosts: ${error.message}`);
  return (data ?? []).map((r) => rowToPost(r as Record<string, unknown>));
}

export async function updatePost(
  id: string,
  patch: Partial<StoredPost>,
): Promise<StoredPost> {
  const existing = await getPost(id);
  if (!existing) throw new Error(`Post ${id} not found`);
  const merged: StoredPost = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return savePost(merged);
}

export async function deletePost(id: string): Promise<void> {
  if (!isStoreLive()) {
    const idx = _memPosts.findIndex((p) => p.id === id);
    if (idx >= 0) _memPosts.splice(idx, 1);
    return;
  }
  const { error } = await server().from("posts").delete().eq("id", id);
  if (error) throw new Error(`Supabase deletePost: ${error.message}`);
}

// ============================================================================
// Config
// ============================================================================

const CONFIG_COLS = `post_time_local, post_timezone, post_days,
  pillar_rotation, goal_rotation,
  cta_lead_gen, cta_brand, cta_course, cta_camp, cta_booking,
  auto_approve,
  higgsfield_avatar_id, higgsfield_avatar_name, higgsfield_avatar_type,
  higgsfield_webproduct_id, higgsfield_webproduct_url,
  higgsfield_mode, higgsfield_duration_sec,
  updated_at`;

function rowToConfig(r: Record<string, unknown>): OperatorConfig {
  return {
    postTimeLocal: (r.post_time_local as string) ?? "09:00",
    postTimezone: (r.post_timezone as string) ?? "America/New_York",
    postDays: (r.post_days as string[]) ?? defaultConfig().postDays,
    pillarRotation:
      (r.pillar_rotation as AdPillar[]) ?? defaultConfig().pillarRotation,
    goalRotation: (r.goal_rotation as AdGoal[]) ?? defaultConfig().goalRotation,
    ctaLeadGen: (r.cta_lead_gen as string) ?? defaultConfig().ctaLeadGen,
    ctaBrand: (r.cta_brand as string) ?? defaultConfig().ctaBrand,
    ctaCourse: (r.cta_course as string) ?? defaultConfig().ctaCourse,
    ctaCamp: (r.cta_camp as string) ?? defaultConfig().ctaCamp,
    ctaBooking: (r.cta_booking as string) ?? defaultConfig().ctaBooking,
    autoApprove: Boolean(r.auto_approve),
    higgsfieldAvatarId:
      (r.higgsfield_avatar_id as string) ?? defaultConfig().higgsfieldAvatarId,
    higgsfieldAvatarName:
      (r.higgsfield_avatar_name as string) ??
      defaultConfig().higgsfieldAvatarName,
    higgsfieldAvatarType:
      ((r.higgsfield_avatar_type as string) ??
        defaultConfig().higgsfieldAvatarType) as OperatorConfig["higgsfieldAvatarType"],
    higgsfieldWebproductId:
      (r.higgsfield_webproduct_id as string) ??
      defaultConfig().higgsfieldWebproductId,
    higgsfieldWebproductUrl:
      (r.higgsfield_webproduct_url as string) ??
      defaultConfig().higgsfieldWebproductUrl,
    higgsfieldMode:
      (r.higgsfield_mode as string) ?? defaultConfig().higgsfieldMode,
    higgsfieldDurationSec:
      (r.higgsfield_duration_sec as number) ??
      defaultConfig().higgsfieldDurationSec,
    updatedAt: (r.updated_at as string) ?? new Date().toISOString(),
  };
}

export async function getConfig(): Promise<OperatorConfig> {
  if (!isStoreLive()) return _memConfig;
  const { data, error } = await server()
    .from("config")
    .select(CONFIG_COLS)
    .eq("singleton", "main")
    .maybeSingle();
  if (error) throw new Error(`Supabase getConfig: ${error.message}`);
  return data
    ? rowToConfig(data as Record<string, unknown>)
    : defaultConfig();
}

export async function saveConfig(
  patch: Partial<OperatorConfig>,
): Promise<OperatorConfig> {
  const current = await getConfig();
  const merged: OperatorConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (!isStoreLive()) {
    _memConfig = merged;
    return merged;
  }
  const { error } = await server()
    .from("config")
    .upsert(
      {
        singleton: "main",
        post_time_local: merged.postTimeLocal,
        post_timezone: merged.postTimezone,
        post_days: merged.postDays,
        pillar_rotation: merged.pillarRotation,
        goal_rotation: merged.goalRotation,
        cta_lead_gen: merged.ctaLeadGen,
        cta_brand: merged.ctaBrand,
        cta_course: merged.ctaCourse,
        cta_camp: merged.ctaCamp,
        cta_booking: merged.ctaBooking,
        auto_approve: merged.autoApprove,
        higgsfield_avatar_id: merged.higgsfieldAvatarId,
        higgsfield_avatar_name: merged.higgsfieldAvatarName,
        higgsfield_avatar_type: merged.higgsfieldAvatarType,
        higgsfield_webproduct_id: merged.higgsfieldWebproductId,
        higgsfield_webproduct_url: merged.higgsfieldWebproductUrl,
        higgsfield_mode: merged.higgsfieldMode,
        higgsfield_duration_sec: merged.higgsfieldDurationSec,
        updated_at: merged.updatedAt,
      },
      { onConflict: "singleton" },
    );
  if (error) throw new Error(`Supabase saveConfig: ${error.message}`);
  return merged;
}

// ============================================================================
// Provider log
// ============================================================================

export async function logProvider(row: ProviderLogRow): Promise<void> {
  if (!isStoreLive()) return;
  try {
    await server().from("provider_log").insert({
      provider: row.provider,
      action: row.action,
      ok: row.ok,
      status_code: row.statusCode ?? null,
      duration_ms: row.durationMs ?? null,
      payload: row.payload ?? null,
      error: row.error ?? null,
    });
  } catch {
    // never let logging failures break the request path
  }
}
