"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Captions,
  Loader2,
  Mic,
  Sparkles,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { PILLARS, type Pillar } from "@/lib/ai";
import type { ContentItem } from "@/lib/types";
import { cn, formatCompact } from "@/lib/utils";

type Status = ContentItem["status"];
const PIPELINE: Status[] = ["Idea", "Scripted", "Edited", "Posted", "Viral"];

export function ContentEngine({ items }: { items: ContentItem[] }) {
  const [pillar, setPillar] = useState<Pillar>("Ball Mastery");
  const [output, setOutput] = useState<{
    hook: string;
    script: string;
    caption: string;
    voiceover: string;
  } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

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

  async function call(kind: "hook" | "caption" | "script" | "voiceover" | "idea") {
    setLoading(kind);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, pillar }),
      });
      const data = await res.json();
      setOutput((prev) => ({
        hook: data.hook ?? prev?.hook ?? "",
        script: data.script ?? prev?.script ?? "",
        caption: data.caption ?? prev?.caption ?? "",
        voiceover: data.voiceover ?? prev?.voiceover ?? "",
      }));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Generator */}
      <section className="card relative overflow-hidden p-6">
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="chip-accent">
                <Sparkles className="h-3 w-3" /> Generator
              </div>
              <h2 className="h-display mt-2 text-2xl font-semibold">
                Generate on-brand content in one tap.
              </h2>
              <p className="mt-1 max-w-lg text-sm text-muted">
                Every output is tuned to the Strive philosophy: creative,
                intelligent football over robotic training.
              </p>
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
                      : "border-white/10 bg-white/[0.03] text-muted hover:text-bone"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
            <GenButton
              label="Generate TikTok Idea"
              icon={<Wand2 className="h-4 w-4" />}
              loading={loading === "idea"}
              onClick={() => call("idea")}
              primary
            />
            <GenButton
              label="Generate Hook"
              icon={<Sparkles className="h-4 w-4" />}
              loading={loading === "hook"}
              onClick={() => call("hook")}
            />
            <GenButton
              label="Generate Voiceover"
              icon={<Mic className="h-4 w-4" />}
              loading={loading === "voiceover"}
              onClick={() => call("voiceover")}
            />
            <GenButton
              label="Generate Caption"
              icon={<Captions className="h-4 w-4" />}
              loading={loading === "caption"}
              onClick={() => call("caption")}
            />
          </div>

          {/* Output */}
          {output && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2"
            >
              <OutputCard label="Hook" value={output.hook} />
              <OutputCard label="Caption" value={output.caption} />
              <OutputCard label="Script" value={output.script} mono />
              <OutputCard label="Voiceover" value={output.voiceover} />
            </motion.div>
          )}

          {!output && (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted">
              Pick a pillar, tap a button. Output lands here in under a second.
            </div>
          )}
        </div>
      </section>

      {/* Pipeline */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="chip">Pipeline</div>
            <h2 className="h-display mt-2 text-2xl font-semibold">
              Idea → Scripted → Edited → Posted → Viral
            </h2>
          </div>
          <button className="btn-ghost text-xs">View all →</button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {PIPELINE.map((status) => (
            <div
              key={status}
              className="card flex flex-col gap-2 p-3"
            >
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

function GenButton({
  label,
  icon,
  onClick,
  loading,
  primary,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        primary ? "btn-accent" : "btn",
        "h-12 justify-start gap-2.5 disabled:opacity-60"
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      <span className="truncate text-left">{label}</span>
    </button>
  );
}

function OutputCard({
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
          mono && "font-mono text-xs"
        )}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function ContentCard({ item }: { item: ContentItem }) {
  return (
    <div
      className={cn(
        "group rounded-xl border p-3 transition-colors",
        item.status === "Viral"
          ? "border-accent/30 bg-accent/[0.06]"
          : "border-white/5 bg-ink-200/40 hover:border-white/10"
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
