"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Copy,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { PILLARS, type Pillar } from "@/lib/ai";
import { cn } from "@/lib/utils";

type GeneratedPost = {
  pillar: Pillar;
  hook: string;
  script: string;
  caption: string;
  provider: "anthropic" | "fallback" | string;
};

// Single state machine for the "Make video & schedule" pipeline.
// Posts only land in GoHighLevel once the video URL is known — so the
// scheduled post always has its media attached.
type ShipState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "rendering"; requestId: string; elapsedSec: number; configured: boolean }
  | {
      kind: "scheduling";
      requestId: string;
      videoUrl: string;
    }
  | {
      kind: "ok";
      requestId: string;
      videoUrl: string;
      scheduledFor: string;
      ghlConfigured: boolean;
      falConfigured: boolean;
    }
  | { kind: "error"; message: string };

type TextOnlyState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; scheduledFor: string; configured: boolean }
  | { kind: "error"; message: string };

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000; // 6 minutes — generous

function pickRandomPillar(): Pillar {
  return PILLARS[Math.floor(Math.random() * PILLARS.length)];
}

function nextSlotLabel(): string {
  const now = new Date();
  const slot = new Date(now);
  if (now.getHours() < 11) {
    slot.setDate(now.getDate());
    slot.setHours(11, 0, 0, 0);
  } else if (now.getHours() < 19) {
    slot.setDate(now.getDate());
    slot.setHours(19, 0, 0, 0);
  } else {
    slot.setDate(now.getDate() + 1);
    slot.setHours(11, 0, 0, 0);
  }
  return slot.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function OneClickContent() {
  const [post, setPost] = useState<GeneratedPost | null>(null);
  const [pillar, setPillar] = useState<Pillar>(() => pickRandomPillar());
  const [hookIdea, setHookIdea] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ship, setShip] = useState<ShipState>({ kind: "idle" });
  const [textOnly, setTextOnly] = useState<TextOnlyState>({ kind: "idle" });
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    setShip({ kind: "idle" });
    setTextOnly({ kind: "idle" });
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillar,
          hook_idea: hookIdea.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `Generation failed (${res.status})`);
        return;
      }
      setPost({
        pillar,
        hook: data.hook,
        script: data.script,
        caption: data.caption,
        provider: data.provider ?? "fallback",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "request_failed");
    } finally {
      setGenerating(false);
    }
  }

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1400);
    } catch {
      // noop
    }
  }

  // Primary path: video → render → schedule, all in one flow.
  // Schedules to GHL only after the video URL is known.
  async function makeVideoAndSchedule() {
    if (!post) return;

    setShip({ kind: "submitting" });

    let requestId: string;
    let falConfigured: boolean;
    try {
      const res = await fetch("/api/content/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: post.script }),
      });
      const data = await res.json();
      if (!res.ok || !data?.requestId) {
        setShip({
          kind: "error",
          message: data?.error || `Video submit failed (${res.status})`,
        });
        return;
      }
      requestId = data.requestId;
      falConfigured = Boolean(data.configured);
    } catch (err) {
      setShip({
        kind: "error",
        message: err instanceof Error ? err.message : "request_failed",
      });
      return;
    }

    setShip({ kind: "rendering", requestId, elapsedSec: 0, configured: falConfigured });

    // Mock submissions (no FAL_KEY) never complete via polling — surface that
    // clearly instead of waiting six minutes for nothing.
    if (!falConfigured) {
      setShip({
        kind: "error",
        message:
          "Fal.ai isn't configured (no FAL_KEY). Set it and retry to render a real video.",
      });
      return;
    }

    const startedAt = Date.now();
    let videoUrl: string | undefined;

    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      await sleep(POLL_INTERVAL_MS);
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      setShip({ kind: "rendering", requestId, elapsedSec, configured: falConfigured });
      try {
        const pollRes = await fetch(
          `/api/fal/ugc?id=${encodeURIComponent(requestId)}`,
          { cache: "no-store" },
        );
        const pollData = await pollRes.json();
        if (pollData?.status === "completed" && pollData?.videoUrl) {
          videoUrl = pollData.videoUrl as string;
          break;
        }
        if (pollData?.status === "failed") {
          setShip({
            kind: "error",
            message: `Render failed: ${pollData.error || "unknown"}`,
          });
          return;
        }
      } catch {
        // transient — keep polling
      }
    }

    if (!videoUrl) {
      setShip({
        kind: "error",
        message:
          "Video render timed out after 6 minutes. Check Fal.ai for the request status.",
      });
      return;
    }

    setShip({ kind: "scheduling", requestId, videoUrl });

    try {
      const schedRes = await fetch("/api/content/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: post.caption,
          platform: "TikTok",
          mediaUrl: videoUrl,
        }),
      });
      const schedData = await schedRes.json();
      if (!schedRes.ok || !schedData?.id) {
        setShip({
          kind: "error",
          message: schedData?.error || `Schedule failed (${schedRes.status})`,
        });
        return;
      }
      setShip({
        kind: "ok",
        requestId,
        videoUrl,
        scheduledFor: schedData.scheduledFor,
        ghlConfigured: Boolean(schedData.configured),
        falConfigured,
      });
    } catch (err) {
      setShip({
        kind: "error",
        message: err instanceof Error ? err.message : "request_failed",
      });
    }
  }

  // Secondary path: caption-only post. Goes to Facebook only (Instagram and
  // TikTok need media). Use this when you just want the words out.
  async function scheduleTextOnly() {
    if (!post) return;
    setTextOnly({ kind: "running" });
    try {
      const res = await fetch("/api/content/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: post.caption,
          platform: "Facebook",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.id) {
        setTextOnly({
          kind: "error",
          message: data?.error || `Schedule failed (${res.status})`,
        });
        return;
      }
      setTextOnly({
        kind: "ok",
        scheduledFor: data.scheduledFor,
        configured: Boolean(data.configured),
      });
    } catch (err) {
      setTextOnly({
        kind: "error",
        message: err instanceof Error ? err.message : "request_failed",
      });
    }
  }

  const shipping =
    ship.kind === "submitting" ||
    ship.kind === "rendering" ||
    ship.kind === "scheduling";

  return (
    <section className="card relative overflow-hidden p-6">
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="chip-accent">
              <Sparkles className="h-3 w-3" />
              One-click content
            </div>
            <h2 className="h-display mt-3 text-2xl font-semibold leading-tight">
              {post ? "Post is ready." : "Generate today's post."}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Generate the hook, script and caption in one tap. The "Ship it"
              button films the UGC video on Fal.ai, waits for it to render, then
              schedules the post to GoHighLevel with the video attached — so it
              actually lands on TikTok and Instagram.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pillar}
              onChange={(e) => setPillar(e.target.value as Pillar)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-bone outline-none hover:border-white/20"
              disabled={shipping}
            >
              {PILLARS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              onClick={generate}
              disabled={generating || shipping}
              className="btn-accent disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Writing…
                </>
              ) : post ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Generate another
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>

        {!post && (
          <div className="mt-4">
            <input
              value={hookIdea}
              onChange={(e) => setHookIdea(e.target.value)}
              placeholder="Optional: drop a hook idea Claude should sharpen"
              className="w-full rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm text-bone placeholder:text-muted focus:border-white/15 focus:outline-none"
            />
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {post && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <CopyCard
                label="Hook"
                value={post.hook}
                onCopy={() => copy("hook", post.hook)}
                copied={copied === "hook"}
              />
              <CopyCard
                label="Caption"
                value={post.caption}
                onCopy={() => copy("caption", post.caption)}
                copied={copied === "caption"}
              />
              <div className="lg:col-span-2">
                <CopyCard
                  label="Script · 15s beat sheet"
                  value={post.script}
                  onCopy={() => copy("script", post.script)}
                  copied={copied === "script"}
                  mono
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                onClick={makeVideoAndSchedule}
                disabled={shipping}
                className="btn-accent disabled:opacity-60"
              >
                {ship.kind === "submitting" && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting to Fal.ai…
                  </>
                )}
                {ship.kind === "rendering" && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rendering video · {ship.elapsedSec}s
                  </>
                )}
                {ship.kind === "scheduling" && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scheduling to GHL…
                  </>
                )}
                {(ship.kind === "idle" ||
                  ship.kind === "ok" ||
                  ship.kind === "error") && (
                  <>
                    <Clapperboard className="h-4 w-4" />
                    {ship.kind === "ok"
                      ? "Ship another"
                      : `Ship it · video → ${nextSlotLabel()}`}
                  </>
                )}
              </button>
              <button
                onClick={scheduleTextOnly}
                disabled={textOnly.kind === "running" || shipping}
                className="btn disabled:opacity-60"
                title="Caption-only post — goes to Facebook (Instagram and TikTok need media)"
              >
                {textOnly.kind === "running" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scheduling…
                  </>
                ) : (
                  <>
                    <CalendarClock className="h-4 w-4" />
                    Text-only (FB)
                  </>
                )}
              </button>
              <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-muted">
                {post.pillar} ·{" "}
                <span
                  className={
                    post.provider === "anthropic" ? "text-accent" : "text-bone"
                  }
                >
                  {post.provider === "anthropic" ? "Claude (live)" : "fallback"}
                </span>
              </span>
            </div>

            {ship.kind === "rendering" && (
              <div className="mt-3 rounded-xl border border-white/5 bg-black/30 p-3 text-xs text-muted">
                Fal.ai is rendering — Kling v1.6 takes ~60-120s. Keep this
                tab open. Request <code className="kbd">{ship.requestId}</code>.
              </div>
            )}

            {ship.kind === "ok" && (
              <div className="mt-3 space-y-2">
                <div className="rounded-xl border border-accent/30 bg-accent/[0.06] p-3 text-xs text-bone">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-accent" />
                  {ship.ghlConfigured ? "Scheduled to GoHighLevel" : "Queued (GHL mock)"} ·{" "}
                  {new Date(ship.scheduledFor).toLocaleString()} · video attached
                </div>
                <a
                  href={ship.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                >
                  <Play className="h-3 w-3" />
                  Preview the rendered video
                </a>
              </div>
            )}

            {ship.kind === "error" && (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-300">
                {ship.message}
              </div>
            )}

            {textOnly.kind === "ok" && (
              <div className="mt-3 rounded-xl border border-accent/30 bg-accent/[0.06] p-3 text-xs text-bone">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-accent" />
                {textOnly.configured ? "Scheduled to Facebook" : "Queued (GHL mock)"} ·{" "}
                {new Date(textOnly.scheduledFor).toLocaleString()} · caption only
              </div>
            )}
            {textOnly.kind === "error" && (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-300">
                {textOnly.message}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function CopyCard({
  label,
  value,
  onCopy,
  copied,
  mono = false,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          {label}
        </div>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-bone"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div
        className={cn(
          "mt-2 whitespace-pre-wrap leading-relaxed text-bone/90",
          mono ? "font-mono text-xs" : "text-sm",
        )}
      >
        {value}
      </div>
    </div>
  );
}
