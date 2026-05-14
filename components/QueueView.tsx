"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Film,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PostStatus, StoredPost } from "@/lib/store";
import type { AdPillar } from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewMode = "queue" | "calendar";

const STATUS_TONES: Record<PostStatus, string> = {
  queued: "border-white/10 bg-white/[0.03] text-muted",
  rendering: "border-blue-400/30 bg-blue-400/10 text-blue-300",
  awaiting_approval: "border-orange-400/40 bg-orange-400/15 text-orange-200",
  approved: "border-accent/40 bg-accent/15 text-accent",
  scheduled: "border-accent/30 bg-accent/[0.08] text-accent",
  posted: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  rejected: "border-white/5 bg-white/[0.02] text-muted line-through",
  failed: "border-red-500/40 bg-red-500/15 text-red-300",
};

const STATUS_LABEL: Record<PostStatus, string> = {
  queued: "Queued",
  rendering: "Rendering",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  scheduled: "Scheduled",
  posted: "Posted",
  rejected: "Rejected",
  failed: "Failed",
};

const PILLAR_TONE: Record<AdPillar, string> = {
  "Ball Mastery": "border-accent/30 bg-accent/15 text-accent",
  Mindset: "border-blue-400/30 bg-blue-400/10 text-blue-300",
  "Behind the Scenes": "border-white/10 bg-white/[0.04] text-bone",
  "Player Spotlight": "border-orange-400/30 bg-orange-400/10 text-orange-300",
  Education: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Offer: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function QueueView({ initialPosts }: { initialPosts: StoredPost[] }) {
  const [posts, setPosts] = useState<StoredPost[]>(initialPosts);
  const [view, setView] = useState<ViewMode>("queue");
  const [filter, setFilter] = useState<"all" | PostStatus>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const res = await fetch("/api/posts");
      const json = await res.json();
      if (json.ok) setPosts(json.posts);
    } catch {
      // ignore
    }
  };

  // Periodic refresh — picks up renders that finish in the background.
  useEffect(() => {
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, []);

  const approve = async (post: StoredPost) => {
    setBusyId(post.id);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Approve failed");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (post: StoredPost) => {
    setBusyId(post.id);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manually rejected" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Reject failed");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  const regenerate = async (post: StoredPost) => {
    setBusyId(post.id);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Regenerate failed");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const c: Record<PostStatus, number> = {
      queued: 0,
      rendering: 0,
      awaiting_approval: 0,
      approved: 0,
      scheduled: 0,
      posted: 0,
      rejected: 0,
      failed: 0,
    };
    for (const p of posts) c[p.status]++;
    return c;
  }, [posts]);

  const filtered =
    filter === "all" ? posts : posts.filter((p) => p.status === filter);

  return (
    <div className="space-y-4">
      {error && (
        <div className="card flex items-center gap-2 border-red-500/30 bg-red-500/[0.05] p-3 text-xs text-red-300">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-200"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-white/5 bg-ink-200/40 p-1">
          <button
            onClick={() => setView("queue")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              view === "queue"
                ? "bg-white/[0.06] text-bone"
                : "text-muted hover:text-bone",
            )}
          >
            Queue
          </button>
          <button
            onClick={() => setView("calendar")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              view === "calendar"
                ? "bg-white/[0.06] text-bone"
                : "text-muted hover:text-bone",
            )}
          >
            Calendar
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <FilterChip label="All" count={posts.length} active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip
            label="Awaiting"
            count={counts.awaiting_approval}
            active={filter === "awaiting_approval"}
            onClick={() => setFilter("awaiting_approval")}
            highlight
          />
          <FilterChip
            label="Scheduled"
            count={counts.scheduled}
            active={filter === "scheduled"}
            onClick={() => setFilter("scheduled")}
          />
          <FilterChip
            label="Posted"
            count={counts.posted}
            active={filter === "posted"}
            onClick={() => setFilter("posted")}
          />
          <FilterChip
            label="Failed"
            count={counts.failed}
            active={filter === "failed"}
            onClick={() => setFilter("failed")}
          />
          <FilterChip
            label="Rejected"
            count={counts.rejected}
            active={filter === "rejected"}
            onClick={() => setFilter("rejected")}
          />
        </div>
      </div>

      {view === "queue" ? (
        <QueueList
          posts={filtered}
          busyId={busyId}
          previewId={previewId}
          setPreviewId={setPreviewId}
          onApprove={approve}
          onReject={reject}
          onRegenerate={regenerate}
        />
      ) : (
        <CalendarGrid
          posts={filtered}
          onClick={(p) => setPreviewId(p.id)}
        />
      )}

      {previewId && (
        <PreviewDrawer
          post={posts.find((p) => p.id === previewId) ?? null}
          onClose={() => setPreviewId(null)}
          onApprove={approve}
          onReject={reject}
          onRegenerate={regenerate}
          busy={busyId === previewId}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  highlight,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all",
        active
          ? highlight
            ? "border-orange-400/40 bg-orange-400/15 text-orange-200"
            : "border-accent/40 bg-accent/15 text-accent"
          : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-bone",
      )}
    >
      {label}
      <span className="rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] tabular-nums">
        {count}
      </span>
    </button>
  );
}

function QueueList({
  posts,
  busyId,
  previewId,
  setPreviewId,
  onApprove,
  onReject,
  onRegenerate,
}: {
  posts: StoredPost[];
  busyId: string | null;
  previewId: string | null;
  setPreviewId: (id: string | null) => void;
  onApprove: (p: StoredPost) => void;
  onReject: (p: StoredPost) => void;
  onRegenerate: (p: StoredPost) => void;
}) {
  if (posts.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 border-dashed py-16 text-center">
        <Sparkles className="h-5 w-5 text-muted" />
        <div className="h-display text-xl font-semibold">Queue is clear.</div>
        <p className="max-w-sm text-xs text-muted">
          Generate one from the Studio or wait for the daily cron at 9am ET.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {posts.map((p, i) => (
        <motion.li
          key={p.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.02 }}
          className="card relative overflow-hidden p-4"
        >
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-20 shrink-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                {p.scheduledFor ? formatDay(p.scheduledFor) : "—"}
              </div>
              <div className="h-display mt-0.5 text-base font-semibold tabular-nums">
                {p.scheduledFor ? formatTime(p.scheduledFor) : "—"}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={p.status} />
                <PillarBadge pillar={p.pillar} />
                <span className="text-[10px] text-muted">{p.platform}</span>
                <span className="text-[10px] text-muted">·</span>
                <span className="text-[10px] text-muted">{p.generatedBy}</span>
              </div>
              <div className="mt-1.5 text-sm font-semibold leading-snug">
                {p.hook}
              </div>
              <div className="mt-1 line-clamp-1 text-[11px] text-muted">
                {p.caption}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {typeof p.viralityScore === "number" && (
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold tabular-nums text-bone">
                  <Sparkles className="mr-1 inline h-2.5 w-2.5 text-accent" />
                  {p.viralityScore}
                </div>
              )}
              <button
                onClick={() => setPreviewId(p.id)}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-muted hover:border-white/20 hover:text-bone"
                aria-label="Preview"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {p.status === "awaiting_approval" && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
              <button
                onClick={() => onApprove(p)}
                disabled={busyId === p.id || !p.videoUrl}
                className={cn(
                  "btn-accent px-3 py-1.5 text-[11px]",
                  (busyId === p.id || !p.videoUrl) && "opacity-60",
                )}
                title={!p.videoUrl ? "Waiting for render" : ""}
              >
                {busyId === p.id ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Scheduling…
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3" />
                    Approve & schedule
                  </>
                )}
              </button>
              <button
                onClick={() => onRegenerate(p)}
                disabled={busyId === p.id}
                className="btn px-3 py-1.5 text-[11px]"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate
              </button>
              <button
                onClick={() => onReject(p)}
                disabled={busyId === p.id}
                className="btn px-3 py-1.5 text-[11px] hover:border-red-500/30 hover:text-red-300"
              >
                <XCircle className="h-3 w-3" />
                Reject
              </button>
            </div>
          )}

          {p.status === "failed" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-red-500/20 pt-3 text-[11px] text-red-300">
              <AlertCircle className="h-3 w-3" />
              <span>{p.rejectReason ?? "Generation or schedule failed."}</span>
              <button
                onClick={() => onRegenerate(p)}
                className="btn ml-auto px-2 py-1 text-[10px]"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          )}
        </motion.li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
        STATUS_TONES[status],
      )}
    >
      {status === "scheduled" || status === "posted" ? (
        <CheckCircle2 className="h-2.5 w-2.5" />
      ) : status === "awaiting_approval" ? (
        <Clock className="h-2.5 w-2.5" />
      ) : status === "rendering" ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : null}
      {STATUS_LABEL[status]}
    </span>
  );
}

function PillarBadge({ pillar }: { pillar: AdPillar }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
        PILLAR_TONE[pillar],
      )}
    >
      {pillar}
    </span>
  );
}

// ============================================================================
// Calendar
// ============================================================================

function CalendarGrid({
  posts,
  onClick,
}: {
  posts: StoredPost[];
  onClick: (p: StoredPost) => void;
}) {
  const today = new Date();
  // Build a 14-day window starting from yesterday.
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1 + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const byDay = useMemo(() => {
    const m = new Map<string, StoredPost[]>();
    for (const p of posts) {
      if (!p.scheduledFor) continue;
      const k = ymd(new Date(p.scheduledFor));
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return m;
  }, [posts]);

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/5">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="border-r border-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const k = ymd(d);
          const items = byDay.get(k) ?? [];
          const isToday = ymd(today) === k;
          return (
            <div
              key={k}
              className={cn(
                "min-h-[120px] border-b border-r border-white/5 p-2 last:border-r-0",
                isToday && "bg-accent/[0.04]",
              )}
            >
              <div
                className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  isToday ? "text-accent" : "text-muted",
                )}
              >
                {d.getDate()}
              </div>
              <div className="mt-1 space-y-1">
                {items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onClick(p)}
                    className={cn(
                      "block w-full truncate rounded-md border px-1.5 py-1 text-left text-[10px] font-medium transition-colors",
                      STATUS_TONES[p.status],
                    )}
                    title={p.hook}
                  >
                    {p.hook.slice(0, 38)}
                    {p.hook.length > 38 ? "…" : ""}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Preview drawer
// ============================================================================

function PreviewDrawer({
  post,
  onClose,
  onApprove,
  onReject,
  onRegenerate,
  busy,
}: {
  post: StoredPost | null;
  onClose: () => void;
  onApprove: (p: StoredPost) => void;
  onReject: (p: StoredPost) => void;
  onRegenerate: (p: StoredPost) => void;
  busy: boolean;
}) {
  if (!post) return null;
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/60 backdrop-blur-sm" />
      <motion.aside
        initial={{ x: 480 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-[520px] overflow-y-auto border-l border-white/5 bg-ink-100/95 backdrop-blur-md"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/5 bg-black/50 px-5 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <StatusBadge status={post.status} />
            <PillarBadge pillar={post.pillar} />
          </div>
          <button onClick={onClose} className="text-muted hover:text-bone">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-ink-300 via-ink-200 to-black">
            <div className="grid h-full w-full place-items-center p-6 text-center">
              <div>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-accent/40 bg-accent/15 text-accent">
                  <Film className="h-5 w-5" />
                </div>
                <div className="mt-3 text-lg font-semibold leading-snug">
                  "{post.hook}"
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted">
                  {post.durationSec}s · 9:16 · {post.platform}
                </div>
                {post.videoUrl && (
                  <div className="mt-2 break-all rounded bg-black/40 p-1.5 text-[9px] text-muted">
                    {post.videoUrl}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Section label="Caption">{post.caption}</Section>
          <Section label="CTA">
            <span className="text-accent">{post.cta}</span>
          </Section>
          <Section label="Script">
            <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed">
              {post.script}
            </pre>
          </Section>
          <Section label="Voiceover">{post.voiceoverScript}</Section>
          <Section label="Video prompt">{post.videoPrompt}</Section>

          {post.viralityNotes && (
            <Section label="Virality coach">
              <span className="text-accent">{post.viralityScore} ·</span>{" "}
              {post.viralityNotes}
            </Section>
          )}

          {post.rejectReason && (
            <Section label="Reject reason">
              <span className="text-red-300">{post.rejectReason}</span>
            </Section>
          )}

          {post.scheduledFor && (
            <Section label="Scheduled for">
              {new Date(post.scheduledFor).toLocaleString()}
            </Section>
          )}

          {post.status === "awaiting_approval" && (
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                onClick={() => onApprove(post)}
                disabled={busy || !post.videoUrl}
                className={cn(
                  "btn-accent justify-center text-xs",
                  (busy || !post.videoUrl) && "opacity-60",
                )}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Approve
              </button>
              <button
                onClick={() => onRegenerate(post)}
                disabled={busy}
                className="btn justify-center text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regen
              </button>
              <button
                onClick={() => onReject(post)}
                disabled={busy}
                className="btn justify-center text-xs hover:border-red-500/30 hover:text-red-300"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          )}
        </div>
      </motion.aside>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className="mt-1.5 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

// ============================================================================
// helpers
// ============================================================================

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
