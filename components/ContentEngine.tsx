"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  Captions,
  Check,
  Clapperboard,
  Film,
  Loader2,
  Mic,
  Play,
  Sparkles,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { PILLARS, type Pillar } from "@/lib/ai";
import type { ContentItem } from "@/lib/types";
import { cn, formatCompact } from "@/lib/utils";

type Status = ContentItem["status"];
const PIPELINE: Status[] = ["Idea", "Scripted", "Edited", "Posted", "Viral"];

type FeedIdea = {
  pillar: Pillar;
  title: string;
  hook: string;
  script: string;
  caption: string;
  voiceover: string;
  creatorPitch: string;
  // Derived state
  selected?: boolean;
  audioDataUri?: string;
  videoJobId?: string;
  videoStatus?: "queued" | "processing" | "completed" | "failed";
  videoUrl?: string;
};

type CreatorStyle = "young-mom" | "older-athlete" | "soccer-dad" | "teen-creator";

export function ContentEngine({ items }: { items: ContentItem[] }) {
  const [pillar, setPillar] = useState<Pillar>("Ball Mastery");
  const [feed, setFeed] = useState<FeedIdea[]>([]);
  const [feeding, setFeeding] = useState(false);
  const [provider, setProvider] = useState<"anthropic" | "fallback" | null>(null);
  const [busyIdx, setBusyIdx] = useState<{ idx: number; kind: string } | null>(null);
  const [creatorStyle, setCreatorStyle] = useState<CreatorStyle>("young-mom");
  const [schedulingState, setSchedulingState] = useState<
    "idle" | "scheduling" | "done" | "error"
  >("idle");
  const [scheduleResult, setScheduleResult] = useState<{
    scheduled: number;
    failed: number;
    configured: boolean;
  } | null>(null);

  const byStatus = useMemo(() => {
    const map: Record<Status, ContentItem[]> = {
      Idea: [],
      Scripted: [],
      Edited: [],
      Posted: [],
      Viral: [],
    };
    for (const c of items) map[c.status].push(c);
    return map;
  }, [items]);

  async function feedMeIdeas() {
    setFeeding(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "feed", count: 5 }),
      });
      const data = await res.json();
      setProvider(data.provider ?? "fallback");
      setFeed(
        (data.ideas ?? []).map((i: FeedIdea) => ({ ...i, selected: true })),
      );
    } finally {
      setFeeding(false);
    }
  }

  function toggleIdea(idx: number) {
    setFeed((prev) =>
      prev.map((i, j) => (j === idx ? { ...i, selected: !i.selected } : i)),
    );
  }

  async function makeVoiceover(idx: number) {
    setBusyIdx({ idx, kind: "voiceover" });
    try {
      const idea = feed[idx];
      const res = await fetch("/api/elevenlabs/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: idea.voiceover }),
      });
      const data = await res.json();
      if (data.audioDataUri) {
        setFeed((prev) =>
          prev.map((it, j) =>
            j === idx ? { ...it, audioDataUri: data.audioDataUri } : it,
          ),
        );
      } else {
        alert(data.error ?? "Voiceover failed. Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID.");
      }
    } finally {
      setBusyIdx(null);
    }
  }

  async function makeUGCVideo(idx: number) {
    setBusyIdx({ idx, kind: "ugc" });
    try {
      const idea = feed[idx];
      const res = await fetch("/api/higgsfield/ugc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitch: idea.creatorPitch,
          pillar: idea.pillar,
          creatorStyle,
          audioDataUri: idea.audioDataUri,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setFeed((prev) =>
          prev.map((it, j) =>
            j === idx
              ? {
                  ...it,
                  videoJobId: data.id,
                  videoStatus: data.status,
                  videoUrl: data.videoUrl,
                }
              : it,
          ),
        );
      } else {
        alert(data.error ?? "UGC video failed.");
      }
    } finally {
      setBusyIdx(null);
    }
  }

  async function scheduleSelected() {
    const chosen = feed.filter((i) => i.selected);
    if (chosen.length === 0) {
      alert("Pick at least one idea.");
      return;
    }
    setSchedulingState("scheduling");
    setScheduleResult(null);
    try {
      const res = await fetch("/api/ghl/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: chosen.map((i) => ({
            caption: i.caption,
            mediaUrl: i.videoUrl,
            platform: "TikTok",
          })),
          cadence: "2x-daily",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSchedulingState("error");
        setScheduleResult({ scheduled: 0, failed: chosen.length, configured: false });
        return;
      }
      setSchedulingState("done");
      setScheduleResult({
        scheduled: data.scheduled,
        failed: data.failed,
        configured: data.configured,
      });
    } catch {
      setSchedulingState("error");
    }
  }

  const selectedCount = feed.filter((i) => i.selected).length;

  return (
    <div className="space-y-6">
      {/* Generator */}
      <section className="card relative overflow-hidden p-6">
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="chip-accent">
                <Sparkles className="h-3 w-3" /> AI engine
              </div>
              <h2 className="h-display mt-2 text-2xl font-semibold">
                Feed me ideas. Make the UGC. Schedule it.
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted">
                One tap pulls fresh on-brand concepts. Another spins them into
                hyper-realistic creator videos. The last one drops them onto
                your GHL calendar — two posts a day, on autopilot.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={creatorStyle}
                onChange={(e) => setCreatorStyle(e.target.value as CreatorStyle)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-bone outline-none hover:border-white/20"
              >
                <option value="young-mom">Creator: soccer mom</option>
                <option value="older-athlete">Creator: older athlete</option>
                <option value="soccer-dad">Creator: soccer dad</option>
                <option value="teen-creator">Creator: teen creator</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-3">
            <GenButton
              label={feeding ? "Generating ideas…" : "Feed me 5 ideas"}
              icon={<Wand2 className="h-4 w-4" />}
              loading={feeding}
              onClick={feedMeIdeas}
              primary
            />
            <GenButton
              label={
                schedulingState === "scheduling"
                  ? "Scheduling…"
                  : `Schedule ${selectedCount} to GHL · 2x/day`
              }
              icon={<CalendarClock className="h-4 w-4" />}
              loading={schedulingState === "scheduling"}
              onClick={scheduleSelected}
              disabled={selectedCount === 0}
            />
            <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-black/30 px-4 py-3 text-xs text-muted">
              <Film className="h-4 w-4 text-accent" />
              <span>
                Pick ideas →{" "}
                <span className="text-bone">Voiceover</span> →{" "}
                <span className="text-bone">UGC</span> →{" "}
                <span className="text-bone">Schedule</span>
              </span>
            </div>
          </div>

          {provider && (
            <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted">
              Ideas powered by{" "}
              <span className={provider === "anthropic" ? "text-accent" : "text-bone"}>
                {provider === "anthropic" ? "Claude (live)" : "fallback templates"}
              </span>
            </div>
          )}

          {scheduleResult && (
            <div
              className={cn(
                "mt-4 rounded-xl border p-3 text-xs",
                scheduleResult.configured
                  ? "border-accent/30 bg-accent/[0.06] text-bone"
                  : "border-white/10 bg-white/[0.02] text-muted",
              )}
            >
              {scheduleResult.configured ? (
                <>
                  Scheduled <span className="text-accent">{scheduleResult.scheduled}</span> posts to
                  GoHighLevel Social Planner across the next{" "}
                  {Math.ceil(scheduleResult.scheduled / 2)} days.
                </>
              ) : (
                <>
                  Queued {scheduleResult.scheduled} posts in mock mode — set{" "}
                  <code className="kbd">GHL_API_KEY</code>,{" "}
                  <code className="kbd">GHL_LOCATION_ID</code>, and{" "}
                  <code className="kbd">GHL_SOCIAL_ACCOUNT_IDS</code> to push live.
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Idea feed */}
      <AnimatePresence>
        {feed.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="chip">Today's feed</div>
                <h3 className="h-display mt-2 text-xl font-semibold">
                  {feed.length} ideas ready. {selectedCount} selected.
                </h3>
              </div>
              <button
                onClick={feedMeIdeas}
                disabled={feeding}
                className="btn-ghost text-xs"
              >
                <Loader2
                  className={cn("h-3 w-3", feeding ? "animate-spin" : "hidden")}
                />
                Refresh feed
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {feed.map((idea, idx) => (
                <IdeaCard
                  key={idx}
                  idea={idea}
                  onToggle={() => toggleIdea(idx)}
                  onVoiceover={() => makeVoiceover(idx)}
                  onUGC={() => makeUGCVideo(idx)}
                  busy={busyIdx?.idx === idx ? busyIdx.kind : null}
                />
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Pillar quick-pick (single output, legacy) */}
      {feed.length === 0 && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="chip">Or, by pillar</div>
              <h3 className="h-display mt-2 text-lg font-semibold">
                Single-shot generator
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PILLARS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPillar(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    pillar === p
                      ? "border-accent bg-accent text-black"
                      : "border-white/10 bg-white/[0.03] text-muted hover:text-bone",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <SinglePillarPanel pillar={pillar} />
        </section>
      )}

      {/* Pipeline */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="chip">Pipeline</div>
            <h2 className="h-display mt-2 text-2xl font-semibold">
              Idea → Scripted → Edited → Posted → Viral
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {PIPELINE.map((status) => (
            <div key={status} className="card flex flex-col gap-2 p-3">
              <div className="flex items-center justify-between px-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {status}
                </div>
                <div className="text-[10px] tabular-nums text-muted">
                  {byStatus[status].length}
                </div>
              </div>
              <div className="space-y-2">
                {byStatus[status].map((c) => (
                  <ContentCard key={c.id} item={c} />
                ))}
                {byStatus[status].length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/5 p-4 text-center text-[11px] text-muted">
                    Empty
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function IdeaCard({
  idea,
  onToggle,
  onVoiceover,
  onUGC,
  busy,
}: {
  idea: FeedIdea;
  onToggle: () => void;
  onVoiceover: () => void;
  onUGC: () => void;
  busy: string | null;
}) {
  return (
    <motion.div
      layout
      className={cn(
        "rounded-2xl border bg-ink-200/40 p-4 transition-colors",
        idea.selected
          ? "border-accent/40 bg-accent/[0.04]"
          : "border-white/5 opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="chip-accent text-[10px]">{idea.pillar}</span>
          </div>
          <div className="mt-2 text-base font-semibold leading-snug">
            {idea.title}
          </div>
          <p className="mt-1 text-xs italic text-muted">"{idea.hook}"</p>
        </div>
        <button
          onClick={onToggle}
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors",
            idea.selected
              ? "border-accent bg-accent text-black"
              : "border-white/15 text-muted hover:text-bone",
          )}
          aria-label={idea.selected ? "Deselect" : "Select"}
        >
          {idea.selected ? <Check className="h-3.5 w-3.5" /> : null}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <Collapsible label="Script">
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-bone/80">
            {idea.script}
          </pre>
        </Collapsible>
        <Collapsible label="Caption">{idea.caption}</Collapsible>
        <Collapsible label="Voiceover">{idea.voiceover}</Collapsible>
        <Collapsible label="Creator pitch (UGC)">
          {idea.creatorPitch}
        </Collapsible>
      </div>

      {idea.audioDataUri && (
        <div className="mt-3">
          <audio controls src={idea.audioDataUri} className="w-full" />
        </div>
      )}

      {idea.videoJobId && (
        <div className="mt-3 rounded-xl border border-white/5 bg-black/40 p-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-3.5 w-3.5 text-accent" />
            <span>Higgsfield job: </span>
            <code className="kbd">{idea.videoJobId}</code>
            <span
              className={cn(
                "chip ml-auto text-[10px]",
                idea.videoStatus === "completed"
                  ? "chip-accent"
                  : idea.videoStatus === "failed"
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "",
              )}
            >
              {idea.videoStatus ?? "queued"}
            </span>
          </div>
          {idea.videoUrl && (
            <a
              href={idea.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-accent hover:underline"
            >
              <Play className="h-3 w-3" /> Open video
            </a>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={onVoiceover}
          disabled={busy === "voiceover"}
          className="btn h-9 text-xs disabled:opacity-60"
        >
          {busy === "voiceover" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          Voiceover
        </button>
        <button
          onClick={onUGC}
          disabled={busy === "ugc"}
          className="btn-accent h-9 text-xs disabled:opacity-60"
        >
          {busy === "ugc" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Clapperboard className="h-3.5 w-3.5" />
          )}
          Make UGC video
        </button>
      </div>
    </motion.div>
  );
}

function Collapsible({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/5 bg-black/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted hover:text-bone"
      >
        <span>{label}</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-xs leading-relaxed text-bone/90">
          {children}
        </div>
      )}
    </div>
  );
}

function SinglePillarPanel({ pillar }: { pillar: Pillar }) {
  const [out, setOut] = useState<{
    hook?: string;
    caption?: string;
    script?: string;
    voiceover?: string;
  }>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function call(kind: "hook" | "caption" | "script" | "voiceover") {
    setLoading(kind);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, pillar }),
      });
      const data = await res.json();
      setOut((prev) => ({ ...prev, [kind]: data[kind] }));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <GenButton
          label="Hook"
          icon={<Sparkles className="h-4 w-4" />}
          loading={loading === "hook"}
          onClick={() => call("hook")}
        />
        <GenButton
          label="Caption"
          icon={<Captions className="h-4 w-4" />}
          loading={loading === "caption"}
          onClick={() => call("caption")}
        />
        <GenButton
          label="Script"
          icon={<Wand2 className="h-4 w-4" />}
          loading={loading === "script"}
          onClick={() => call("script")}
        />
        <GenButton
          label="Voiceover"
          icon={<Mic className="h-4 w-4" />}
          loading={loading === "voiceover"}
          onClick={() => call("voiceover")}
        />
      </div>
      {Object.values(out).some(Boolean) && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {out.hook && <Out label="Hook" value={out.hook} />}
          {out.caption && <Out label="Caption" value={out.caption} />}
          {out.script && <Out label="Script" value={out.script} mono />}
          {out.voiceover && <Out label="Voiceover" value={out.voiceover} />}
        </div>
      )}
    </div>
  );
}

function Out({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          {label}
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(value)}
          className="text-[11px] text-muted hover:text-bone"
        >
          Copy
        </button>
      </div>
      <div
        className={cn(
          "mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bone/90",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function GenButton({
  label,
  icon,
  onClick,
  loading,
  primary,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        primary ? "btn-accent" : "btn",
        "h-12 justify-start gap-2.5 disabled:opacity-50",
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      <span className="truncate text-left">{label}</span>
    </button>
  );
}

function ContentCard({ item }: { item: ContentItem }) {
  return (
    <div
      className={cn(
        "group rounded-xl border p-3 transition-colors",
        item.status === "Viral"
          ? "border-accent/30 bg-accent/[0.06]"
          : "border-white/5 bg-ink-200/40 hover:border-white/10",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          {item.platform}
        </span>
        <span className="text-muted">·</span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
          {item.pillar}
        </span>
      </div>
      <div className="mt-1 text-sm font-semibold leading-snug">
        {item.title}
      </div>
      {item.hook && (
        <p className="mt-1 line-clamp-2 text-[11px] italic text-muted">
          "{item.hook}"
        </p>
      )}
      {item.views !== undefined && (
        <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-muted">
          <span className="inline-flex items-center gap-1 text-bone">
            <TrendingUp className="h-3 w-3 text-accent" />
            {formatCompact(item.views)}
          </span>
          <span>♥ {formatCompact(item.likes ?? 0)}</span>
          <span>↗ {formatCompact(item.shares ?? 0)}</span>
        </div>
      )}
    </div>
  );
}
