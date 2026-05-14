"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  Calendar,
  Check,
  Clapperboard,
  Copy,
  Eye,
  Film,
  Loader2,
  Megaphone,
  Mic2,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { AdAsset, AdGoal, AdPillar } from "@/lib/types";
import { cn } from "@/lib/utils";

const PILLARS: AdPillar[] = [
  "Ball Mastery",
  "Mindset",
  "Behind the Scenes",
  "Player Spotlight",
  "Education",
  "Offer",
];

const GOALS: AdGoal[] = ["Lead-gen", "Brand", "Course", "Camp", "Booking"];

const PROMPT_PRESETS = [
  "First-touch under pressure — 200 reps a day",
  "Why $40 drop-ins are the most expensive thing you'll buy this summer",
  "Coach Yinka quit college soccer for this — origin story",
  "Inside a Strive session — 60 minutes",
  "Zara's Cruyff combo — she's 13",
  "Spot counter: 20 of 60 sold. Don't sleep on this.",
];

export function AdStudio() {
  const [idea, setIdea] = useState("");
  const [pillar, setPillar] = useState<AdPillar | "auto">("auto");
  const [goal, setGoal] = useState<AdGoal | "auto">("auto");
  const [asset, setAsset] = useState<AdAsset | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [strategist, setStrategist] = useState<"claude" | "fallback" | null>(null);
  const [generating, setGenerating] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setAsset(null);
    setPostId(null);
    setScheduledAt(null);
    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: idea.trim(),
          pillar: pillar === "auto" ? undefined : pillar,
          goal: goal === "auto" ? undefined : goal,
          platform: "TikTok",
          persist: true,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(
          json.error ?? `Generation failed (HTTP ${res.status})`,
        );
      }
      setAsset(json.asset);
      setPostId(json.post?.id ?? null);
      setStrategist(json.strategist ?? null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Generation failed. Check provider status in Settings.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const approveNow = async () => {
    if (!postId) return;
    setScheduling(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(
          json.error ?? `Schedule failed (HTTP ${res.status})`,
        );
      }
      setScheduledAt(json.post?.scheduledFor ?? null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Schedule failed. Check Settings.",
      );
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      {/* INPUT COLUMN */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card relative overflow-hidden p-5 lg:col-span-2"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative">
          <div className="chip-accent">
            <Wand2 className="h-3 w-3" />
            Idea → ad
          </div>
          <h2 className="h-display mt-2 text-2xl font-semibold leading-tight">
            Make a viral ad in 60 seconds.
          </h2>
          <p className="mt-1 text-xs text-muted">
            Drop an idea or leave blank — the strategist picks today's pillar
            and writes the whole ad: hook, script, voiceover, video prompt, and
            caption.
          </p>

          <div className="mt-5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Idea
            </label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. 'Why first touch decides everything' — or leave blank, the AI will pick."
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-white/5 bg-black/30 px-3 py-2.5 text-sm text-bone placeholder:text-muted/60 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {PROMPT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setIdea(p)}
                className="rounded-full border border-white/5 bg-white/[0.02] px-2 py-1 text-[10px] text-muted hover:border-white/10 hover:text-bone"
              >
                {p.length > 38 ? p.slice(0, 37) + "…" : p}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Selector
              label="Pillar"
              value={pillar}
              onChange={(v) => setPillar(v as AdPillar | "auto")}
              options={[
                { value: "auto", label: "Auto (today's rotation)" },
                ...PILLARS.map((p) => ({ value: p, label: p })),
              ]}
            />
            <Selector
              label="Goal"
              value={goal}
              onChange={(v) => setGoal(v as AdGoal | "auto")}
              options={[
                { value: "auto", label: "Auto" },
                ...GOALS.map((g) => ({ value: g, label: g })),
              ]}
            />
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className={cn(
              "btn-accent mt-5 w-full justify-center text-sm",
              generating && "opacity-70",
            )}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating ad…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate viral ad
              </>
            )}
          </button>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-dashed border-white/10 p-3 text-[11px] text-muted">
            <span className="text-bone">Auto-poster:</span> the cron at{" "}
            <code className="kbd">/api/cron/daily-tiktok</code> generates and
            schedules one TikTok every morning at 9am ET. Wire it to Vercel
            Cron or a GHL workflow to make it daily.
          </div>
        </div>
      </motion.section>

      {/* PREVIEW COLUMN */}
      <section className="lg:col-span-3">
        {!asset && !generating && <EmptyPreview />}
        {generating && <GeneratingPreview />}
        {asset && (
          <AdPreview
            asset={asset}
            postId={postId}
            strategist={strategist}
            onSchedule={approveNow}
            onRegenerate={generate}
            scheduling={scheduling}
            scheduledAt={scheduledAt}
            error={error}
          />
        )}
      </section>
    </div>
  );
}

function Selector<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1.5 w-full appearance-none rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-sm text-bone focus:border-accent/40 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-200">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="card flex h-full min-h-[420px] flex-col items-center justify-center gap-3 border-dashed p-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/5 bg-white/[0.02]">
        <Film className="h-5 w-5 text-muted" />
      </div>
      <div>
        <div className="h-display text-xl font-semibold">No ad yet.</div>
        <p className="mt-1 max-w-sm text-xs text-muted">
          Drop an idea (or leave blank) and hit <span className="text-bone">Generate viral ad</span>.
          The strategist writes it, Higgsfield renders the video, ElevenLabs
          does the voiceover.
        </p>
      </div>
    </div>
  );
}

function GeneratingPreview() {
  const stages = [
    { icon: Wand2, label: "Writing hook + script" },
    { icon: Film, label: "Rendering video (Higgsfield)" },
    { icon: Mic2, label: "Recording voiceover (ElevenLabs)" },
    { icon: Clapperboard, label: "Composing 9:16 master" },
  ];
  return (
    <div className="card relative h-full min-h-[420px] overflow-hidden p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/5" />
      <div className="relative">
        <div className="chip-accent">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating
        </div>
        <h3 className="h-display mt-3 text-2xl font-semibold">
          Cooking up your ad…
        </h3>
        <p className="mt-1 text-xs text-muted">
          Average run time 35–60s once Higgsfield + ElevenLabs are wired.
        </p>

        <div className="mt-6 space-y-3">
          {stages.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 p-3"
              >
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-medium">{s.label}</div>
                <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdPreview({
  asset,
  postId,
  strategist,
  onSchedule,
  onRegenerate,
  scheduling,
  scheduledAt,
  error,
}: {
  asset: AdAsset;
  postId: string | null;
  strategist: "claude" | "fallback" | null;
  onSchedule: () => void;
  onRegenerate: () => void;
  scheduling: boolean;
  scheduledAt: string | null;
  error: string | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <motion.div
      key={asset.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Video preview */}
        <div className="card relative overflow-hidden">
          <div className="aspect-[9/16] w-full bg-gradient-to-br from-ink-300 via-ink-200 to-black">
            <div className="grid h-full w-full place-items-center">
              <div className="text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-accent/40 bg-accent/15 text-accent">
                  <Play className="h-5 w-5" />
                </div>
                <div className="mt-3 px-6 text-lg font-semibold leading-snug text-bone">
                  "{asset.hook}"
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted">
                  {asset.durationSec}s · 9:16 · TikTok
                </div>
                <div className="mt-1 text-[10px] text-muted">
                  preview · video URL: <code className="kbd">{asset.videoUrl?.slice(0, 38)}…</code>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute right-3 top-3 flex gap-1">
            <ViralityChip score={asset.viralityScore ?? 0} />
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-1.5">
            <span className="chip-accent text-[9px]">{asset.pillar}</span>
            <span className="chip text-[9px]">{asset.goal}</span>
            <span className="chip text-[9px]">{asset.voiceoverModel.split("/")[0]}</span>
            <span className="chip text-[9px]">{asset.videoModel.split("/")[0]}</span>
          </div>
        </div>

        {/* Meta + actions */}
        <div className="space-y-3">
          <div className="card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Caption
            </div>
            <div className="mt-1.5 text-sm leading-relaxed">{asset.caption}</div>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => copy("caption", asset.caption)}
                className="btn-ghost px-2 py-1 text-[10px]"
              >
                {copied === "caption" ? (
                  <>
                    <Check className="h-3 w-3 text-accent" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy caption
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              CTA
            </div>
            <div className="mt-1.5 text-sm font-semibold text-accent">
              {asset.cta}
            </div>
          </div>

          {!scheduledAt && (
            <div className="rounded-xl border border-orange-400/30 bg-orange-400/[0.04] p-3 text-[11px] text-orange-200">
              Saved to <Link href="/queue" className="font-semibold underline">queue</Link>{" "}
              as <span className="font-semibold">awaiting approval</span>.
              Review there, or approve right now below.
            </div>
          )}

          <button
            type="button"
            onClick={onSchedule}
            disabled={scheduling || !!scheduledAt || !postId}
            className={cn(
              "btn-accent w-full justify-center text-sm",
              (scheduling || scheduledAt || !postId) && "opacity-80",
            )}
          >
            {scheduledAt ? (
              <>
                <Check className="h-4 w-4" />
                Scheduled · {new Date(scheduledAt).toLocaleString()}
              </>
            ) : scheduling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Approving & scheduling…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Approve & schedule now
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRegenerate}
              className="btn justify-center text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </button>
            <Link href="/queue" className="btn justify-center text-sm">
              <Eye className="h-4 w-4" />
              View queue
            </Link>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.05] p-3 text-xs text-red-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {strategist && (
            <div className="text-center text-[10px] text-muted">
              Strategist:{" "}
              <span className={strategist === "claude" ? "text-accent" : "text-orange-300"}>
                {strategist === "claude" ? "Claude (live)" : "Template fallback"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Script + voiceover + video prompt */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CardBlock
          icon={Megaphone}
          label="Hook + script"
          body={asset.script}
          onCopy={() => copy("script", asset.script)}
          copiedLabel={copied === "script" ? "Copied" : "Copy"}
        />
        <CardBlock
          icon={Mic2}
          label="Voiceover · ElevenLabs"
          body={asset.voiceoverScript}
          onCopy={() => copy("voice", asset.voiceoverScript)}
          copiedLabel={copied === "voice" ? "Copied" : "Copy"}
        />
        <CardBlock
          icon={Film}
          label="Video prompt · Higgsfield"
          body={asset.videoPrompt}
          onCopy={() => copy("prompt", asset.videoPrompt)}
          copiedLabel={copied === "prompt" ? "Copied" : "Copy"}
        />
      </div>

      {asset.viralityNotes && (
        <div className="card flex items-start gap-3 p-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Virality coach
            </div>
            <div className="mt-0.5 text-sm">{asset.viralityNotes}</div>
          </div>
        </div>
      )}

      {scheduledAt && (
        <div className="card flex items-center gap-3 border-accent/30 bg-accent/[0.05] p-4">
          <Calendar className="h-4 w-4 text-accent" />
          <div className="text-sm">
            Locked in for{" "}
            <span className="font-semibold text-bone">
              {new Date(scheduledAt).toLocaleString()}
            </span>{" "}
            via GHL Social Planner. You can edit / cancel in GHL.
          </div>
        </div>
      )}
    </motion.div>
  );
}

function CardBlock({
  icon: Icon,
  label,
  body,
  onCopy,
  copiedLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  body: string;
  onCopy: () => void;
  copiedLabel: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-accent" />
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            {label}
          </div>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="btn-ghost px-2 py-1 text-[10px]"
        >
          {copiedLabel}
        </button>
      </div>
      <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-bone/90">
        {body}
      </pre>
    </div>
  );
}

function ViralityChip({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "border-accent/40 bg-accent/15 text-accent"
      : score >= 65
      ? "border-orange-400/30 bg-orange-400/10 text-orange-300"
      : "border-white/10 bg-white/[0.04] text-muted";
  return (
    <div
      className={cn(
        "rounded-full border px-2 py-1 text-[10px] font-semibold tabular-nums backdrop-blur-md",
        tone,
      )}
    >
      Virality {score}
    </div>
  );
}
