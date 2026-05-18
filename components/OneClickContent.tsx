"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Copy,
  Loader2,
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

type SchedState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; scheduledFor: string; platform: string; configured: boolean }
  | { kind: "error"; message: string };

type VideoState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; requestId: string; configured: boolean }
  | { kind: "error"; message: string };

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

export function OneClickContent() {
  const [post, setPost] = useState<GeneratedPost | null>(null);
  const [pillar, setPillar] = useState<Pillar>(() => pickRandomPillar());
  const [hookIdea, setHookIdea] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sched, setSched] = useState<SchedState>({ kind: "idle" });
  const [video, setVideo] = useState<VideoState>({ kind: "idle" });
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    setSched({ kind: "idle" });
    setVideo({ kind: "idle" });
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

  async function scheduleNow() {
    if (!post) return;
    setSched({ kind: "running" });
    try {
      const res = await fetch("/api/content/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: post.caption,
          platform: "TikTok",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.id) {
        setSched({
          kind: "error",
          message: data?.error || `Schedule failed (${res.status})`,
        });
        return;
      }
      setSched({
        kind: "ok",
        scheduledFor: data.scheduledFor,
        platform: data.platform,
        configured: Boolean(data.configured),
      });
    } catch (err) {
      setSched({
        kind: "error",
        message: err instanceof Error ? err.message : "request_failed",
      });
    }
  }

  async function makeVideo() {
    if (!post) return;
    setVideo({ kind: "running" });
    try {
      const res = await fetch("/api/content/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: post.script }),
      });
      const data = await res.json();
      if (!res.ok || !data?.requestId) {
        setVideo({
          kind: "error",
          message: data?.error || `Video failed (${res.status})`,
        });
        return;
      }
      setVideo({
        kind: "ok",
        requestId: data.requestId,
        configured: Boolean(data.configured),
      });
    } catch (err) {
      setVideo({
        kind: "error",
        message: err instanceof Error ? err.message : "request_failed",
      });
    }
  }

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
              One tap writes the hook, script, and caption. Then push it to
              GoHighLevel's next slot, or kick off a UGC video — all without
              leaving this card.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pillar}
              onChange={(e) => setPillar(e.target.value as Pillar)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-bone outline-none hover:border-white/20"
            >
              {PILLARS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              onClick={generate}
              disabled={generating}
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
                onClick={scheduleNow}
                disabled={sched.kind === "running"}
                className="btn-accent disabled:opacity-60"
              >
                {sched.kind === "running" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scheduling…
                  </>
                ) : (
                  <>
                    <CalendarClock className="h-4 w-4" />
                    Schedule to {nextSlotLabel()}
                  </>
                )}
              </button>
              <button
                onClick={makeVideo}
                disabled={video.kind === "running"}
                className="btn disabled:opacity-60"
              >
                {video.kind === "running" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Clapperboard className="h-4 w-4" />
                    Make UGC video
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

            {sched.kind === "ok" && (
              <div className="mt-3 rounded-xl border border-accent/30 bg-accent/[0.06] p-3 text-xs text-bone">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-accent" />
                {sched.configured
                  ? `Scheduled to GoHighLevel · ${new Date(
                      sched.scheduledFor,
                    ).toLocaleString()}`
                  : `Queued (mock — wire GHL_API_KEY to publish for real) · ${new Date(
                      sched.scheduledFor,
                    ).toLocaleString()}`}
              </div>
            )}
            {sched.kind === "error" && (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-300">
                {sched.message}
              </div>
            )}

            {video.kind === "ok" && (
              <div className="mt-3 rounded-xl border border-accent/30 bg-accent/[0.06] p-3 text-xs text-bone">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-accent" />
                {video.configured ? "Fal.ai" : "Mock"} job submitted ·{" "}
                <code className="kbd">{video.requestId}</code>
              </div>
            )}
            {video.kind === "error" && (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-300">
                {video.message}
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
