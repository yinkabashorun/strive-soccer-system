"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Clapperboard,
  Copy,
  Loader2,
  Mic,
  Skull,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Creative = {
  id: string;
  title: string | null;
  audience: string | null;
  pain_point: string | null;
  transformation: string | null;
  tone: string | null;
  platform: string | null;
  hook: string | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
  shot_list: string | null;
  voiceover_script: string | null;
  landing_angle: string | null;
  vsl_section: string | null;
  status: string;
  voiceover_audio_url: string | null;
  fal_request_id: string | null;
  video_url: string | null;
  performance_notes: string | null;
  created_at: string;
};

const STATUSES = [
  "idea",
  "script_ready",
  "voiceover_ready",
  "video_ready",
  "published",
  "winner",
  "loser",
] as const;

type Status = (typeof STATUSES)[number];

const STATUS_LABEL: Record<string, string> = {
  idea: "Idea",
  script_ready: "Script ready",
  voiceover_ready: "Voiceover ready",
  video_ready: "Video ready",
  published: "Published",
  winner: "Winner",
  loser: "Loser",
};

const STATUS_CLASS: Record<string, string> = {
  idea: "chip",
  script_ready: "chip",
  voiceover_ready: "chip border-blue-500/20 bg-blue-500/10 text-blue-300",
  video_ready: "chip border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  published: "chip border-purple-500/20 bg-purple-500/10 text-purple-300",
  winner: "chip-accent",
  loser: "chip border-red-500/20 bg-red-500/10 text-red-300",
};

export function CreativeLibrary({
  creatives,
  supabaseConfigured,
}: {
  creatives: Creative[];
  supabaseConfigured: boolean;
}) {
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [local, setLocal] = useState<Creative[]>(creatives);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? local : local.filter((c) => c.status === filter)),
    [local, filter],
  );

  async function updateStatus(id: string, status: Status) {
    setBusyId(id);
    const prev = local;
    setLocal((curr) =>
      curr.map((c) => (c.id === id ? { ...c, status } : c)),
    );
    try {
      const res = await fetch(`/api/creatives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`update_failed_${res.status}`);
    } catch {
      setLocal(prev);
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(c: Creative) {
    setBusyId(c.id);
    try {
      const res = await fetch("/api/creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: c.title ? `${c.title} (copy)` : "Copy",
          audience: c.audience,
          painPoint: c.pain_point,
          transformation: c.transformation,
          tone: c.tone,
          platform: c.platform,
          hook: c.hook,
          script: c.script,
          caption: c.caption,
          cta: c.cta,
          shotList: c.shot_list,
          voiceoverScript: c.voiceover_script,
          landingAngle: c.landing_angle,
          vslSection: c.vsl_section,
          status: "script_ready",
        }),
      });
      const data = await res.json();
      if (data?.creative) {
        setLocal((curr) => [data.creative, ...curr]);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function makeVoiceover(c: Creative) {
    if (!c.voiceover_script) return;
    setBusyId(c.id);
    try {
      const res = await fetch("/api/elevenlabs/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: c.voiceover_script }),
      });
      const data = await res.json();
      if (data?.audioDataUri) {
        await fetch(`/api/creatives/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voiceover_audio_url: data.audioDataUri,
            status: "voiceover_ready",
          }),
        });
        setLocal((curr) =>
          curr.map((it) =>
            it.id === c.id
              ? {
                  ...it,
                  voiceover_audio_url: data.audioDataUri,
                  status: "voiceover_ready",
                }
              : it,
          ),
        );
      } else {
        alert(data?.error ?? "Voiceover failed.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function makeVideo(c: Creative) {
    if (!c.script) return;
    setBusyId(c.id);
    try {
      const res = await fetch("/api/content/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: c.script }),
      });
      const data = await res.json();
      const requestId = data?.requestId ?? data?.id;
      if (requestId) {
        await fetch(`/api/creatives/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fal_request_id: requestId }),
        });
        setLocal((curr) =>
          curr.map((it) =>
            it.id === c.id ? { ...it, fal_request_id: requestId } : it,
          ),
        );
        alert(
          `Fal request submitted. Poll /api/fal/ugc?id=${requestId} until completed, then paste the video URL in.`,
        );
      } else {
        alert(data?.error ?? "Video submit failed.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this creative?")) return;
    setBusyId(id);
    const prev = local;
    setLocal((curr) => curr.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/creatives/${id}`, { method: "DELETE" });
      if (!res.ok) setLocal(prev);
    } finally {
      setBusyId(null);
    }
  }

  if (!supabaseConfigured) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto max-w-md">
          <h3 className="h-display text-xl font-semibold">Supabase not wired</h3>
          <p className="mt-2 text-sm text-muted">
            Set <code className="kbd">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="kbd">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then
            apply the <code className="kbd">004_creatives.sql</code> migration
            to start saving ads here.
          </p>
        </div>
      </div>
    );
  }

  if (local.length === 0) {
    return (
      <div className="card relative overflow-hidden p-12 text-center">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative mx-auto max-w-md">
          <h3 className="h-display text-xl font-semibold">No creatives yet.</h3>
          <p className="mt-2 text-sm text-muted">
            Generate your first ad from the{" "}
            <Link href="/ugc" className="text-accent hover:underline">
              UGC Generator
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={`All · ${local.length}`}
        />
        {STATUSES.map((s) => {
          const count = local.filter((c) => c.status === s).length;
          if (count === 0) return null;
          return (
            <Chip
              key={s}
              active={filter === s}
              onClick={() => setFilter(s)}
              label={`${STATUS_LABEL[s]} · ${count}`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => (
          <Card
            key={c.id}
            creative={c}
            busy={busyId === c.id}
            onStatus={(s) => updateStatus(c.id, s)}
            onDuplicate={() => duplicate(c)}
            onVoice={() => makeVoiceover(c)}
            onVideo={() => makeVideo(c)}
            onDelete={() => remove(c.id)}
          />
        ))}
      </div>
    </>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent text-black"
          : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-bone",
      )}
    >
      {label}
    </button>
  );
}

function Card({
  creative,
  busy,
  onStatus,
  onDuplicate,
  onVoice,
  onVideo,
  onDelete,
}: {
  creative: Creative;
  busy: boolean;
  onStatus: (s: Status) => void;
  onDuplicate: () => void;
  onVoice: () => void;
  onVideo: () => void;
  onDelete: () => void;
}) {
  const c = creative;
  const created = new Date(c.created_at).toLocaleDateString();
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/5 blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted">
              <span>{c.platform ?? "—"}</span>
              <span>·</span>
              <span>{c.audience ?? "—"}</span>
              <span>·</span>
              <span>{created}</span>
            </div>
            <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">
              {c.hook ?? c.title ?? "Untitled creative"}
            </h3>
          </div>
          <span className={STATUS_CLASS[c.status] ?? "chip"}>
            {STATUS_LABEL[c.status] ?? c.status}
          </span>
        </div>

        {c.caption && (
          <p className="mt-2 line-clamp-2 text-xs italic text-muted">
            "{c.caption}"
          </p>
        )}

        {c.vsl_section && (
          <div className="mt-3 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-[11px] text-muted">
            <span className="text-bone">VSL section →</span> {c.vsl_section}
          </div>
        )}

        {c.voiceover_audio_url && (
          <audio
            controls
            src={c.voiceover_audio_url}
            className="mt-3 w-full"
          />
        )}

        {c.video_url && (
          <a
            href={c.video_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            Open rendered video →
          </a>
        )}

        {/* Status promote/demote */}
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onStatus("winner")}
            disabled={busy}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
              c.status === "winner"
                ? "border-accent bg-accent text-black"
                : "border-white/10 bg-white/[0.03] text-muted hover:border-accent/40 hover:text-accent",
            )}
          >
            <Award className="mr-1 inline h-3 w-3" />
            Winner
          </button>
          <button
            onClick={() => onStatus("published")}
            disabled={busy}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
              c.status === "published"
                ? "border-purple-500 bg-purple-500/20 text-purple-200"
                : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-bone",
            )}
          >
            <TrendingUp className="mr-1 inline h-3 w-3" />
            Published
          </button>
          <button
            onClick={() => onStatus("loser")}
            disabled={busy}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
              c.status === "loser"
                ? "border-red-500 bg-red-500/20 text-red-200"
                : "border-white/10 bg-white/[0.03] text-muted hover:border-red-500/40 hover:text-red-300",
            )}
          >
            <Skull className="mr-1 inline h-3 w-3" />
            Loser
          </button>
        </div>

        {/* Actions */}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            onClick={onVoice}
            disabled={busy || !c.voiceover_script}
            className="btn h-8 text-[11px] disabled:opacity-50"
            title={c.voiceover_script ? "" : "No voiceover script"}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Mic className="h-3 w-3" />
            )}
            Voiceover
          </button>
          <button
            onClick={onVideo}
            disabled={busy || !c.script}
            className="btn h-8 text-[11px] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Clapperboard className="h-3 w-3" />
            )}
            UGC video
          </button>
          <button
            onClick={onDuplicate}
            disabled={busy}
            className="btn h-8 text-[11px] disabled:opacity-50"
          >
            <Copy className="h-3 w-3" />
            Duplicate
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="btn h-8 text-[11px] text-red-300 hover:border-red-500/40 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
