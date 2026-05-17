"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Rocket,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Configured = {
  anthropic: boolean;
  elevenlabs: boolean;
  fal: boolean;
  ghl: boolean;
};

type RunSummary = {
  startedAt: string;
  finishedAt: string;
  totals: { ideas: number; scheduled: number; videoCompleted: number };
  produced: Array<{
    pillar: string;
    hook: string;
    caption: string;
    creatorStyle: string;
    voiceover: { ok: boolean; error?: string };
    video: { ok: boolean; jobId?: string; status?: string; videoUrl?: string; error?: string };
    schedule: { ok: boolean; id?: string; scheduledFor?: string; error?: string };
  }>;
};

type Status = {
  fullyAutonomous: boolean;
  configured: Configured;
  nextRun: string;
  inFlight: boolean;
  startedAt?: string;
  lastRun: RunSummary | null;
};

export function AutopilotPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/autopilot/status", { cache: "no-store" });
      const data = await res.json();
      setStatus(data);
    } catch {
      // keep previous status
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, []);

  async function runNow() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/cron/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 14 }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || "Autopilot failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "request_failed");
    } finally {
      setRunning(false);
    }
  }

  const next = status ? new Date(status.nextRun) : null;
  const inFlight = status?.inFlight || running;

  return (
    <section className="card relative overflow-hidden p-6">
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <div className="chip-accent">
                <Rocket className="h-3 w-3" /> Autopilot
              </div>
              {status && (
                <div
                  className={cn(
                    "chip text-[10px]",
                    status.fullyAutonomous
                      ? "border-accent/30 bg-accent/[0.08] text-accent"
                      : "border-amber-500/30 bg-amber-500/[0.08] text-amber-300",
                  )}
                >
                  {status.fullyAutonomous ? (
                    <>
                      <Wifi className="h-3 w-3" /> Fully autonomous
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3" /> Needs keys
                    </>
                  )}
                </div>
              )}
            </div>
            <h2 className="h-display mt-3 text-2xl font-semibold leading-tight">
              {status?.fullyAutonomous
                ? "Your content is on autopilot."
                : "Wire the keys. Then never touch it again."}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Every Monday at 08:00 UTC, Strive OS generates 14 fresh ideas,
              voices them with ElevenLabs, films UGC-style videos with
              Fal.ai, and schedules two posts a day for the week onto your
              GoHighLevel Social Planner. Zero clicks.
            </p>
          </div>
          <button
            onClick={runNow}
            disabled={inFlight}
            className="btn-accent disabled:opacity-60"
          >
            {inFlight ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Working — this can take a few minutes
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Run autopilot now
              </>
            )}
          </button>
        </div>

        {/* Status grid */}
        {status && (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Claude · ideas" ok={status.configured.anthropic} />
            <Tile label="ElevenLabs · voice" ok={status.configured.elevenlabs} />
            <Tile label="Fal.ai · UGC" ok={status.configured.fal} />
            <Tile label="GHL · scheduler" ok={status.configured.ghl} />
          </div>
        )}

        {/* Next run + last run */}
        {status && (
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                <CalendarClock className="h-3.5 w-3.5 text-accent" />
                Next run
              </div>
              <div className="mt-2 text-lg font-semibold">
                {next?.toLocaleString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                Produces 14 posts → 2 per day for 7 days.
              </div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                Last run
              </div>
              {status.lastRun ? (
                <>
                  <div className="mt-2 text-lg font-semibold tabular-nums">
                    {status.lastRun.totals.scheduled} / {status.lastRun.totals.ideas} scheduled
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    {status.lastRun.totals.videoCompleted} videos rendered ·{" "}
                    {new Date(status.lastRun.finishedAt).toLocaleString()}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-muted">
                  Never run. Click "Run autopilot now" to kick it off.
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Latest produced posts */}
        {status?.lastRun && status.lastRun.produced.length > 0 && (
          <div className="mt-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Scheduled this run
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {status.lastRun.produced.slice(0, 8).map((p, i) => (
                <ProducedRow key={i} produced={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Tile({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-xs",
        ok
          ? "border-accent/30 bg-accent/[0.05] text-bone"
          : "border-white/5 bg-white/[0.02] text-muted",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            ok ? "bg-accent" : "bg-white/20",
          )}
        />
        {label}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted">
        {ok ? "live" : "needs key"}
      </div>
    </div>
  );
}

function ProducedRow({
  produced,
}: {
  produced: RunSummary["produced"][number];
}) {
  const when = produced.schedule.scheduledFor
    ? new Date(produced.schedule.scheduledFor).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
  return (
    <div className="rounded-xl border border-white/5 bg-ink-200/40 p-3">
      <div className="flex items-center gap-2">
        <span className="chip-accent text-[10px]">{produced.pillar}</span>
        <span className="text-[10px] text-muted">{produced.creatorStyle}</span>
        <span className="ml-auto text-[10px] tabular-nums text-muted">{when}</span>
      </div>
      <div className="mt-1 line-clamp-2 text-xs italic text-bone/80">
        "{produced.hook}"
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        <Badge ok={produced.voiceover.ok} label="VO" />
        <Badge ok={produced.video.ok} label="UGC" />
        <Badge ok={produced.schedule.ok} label="GHL" />
        {produced.video.videoUrl && (
          <a
            href={produced.video.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-accent hover:underline"
          >
            Open video →
          </a>
        )}
      </div>
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5",
        ok
          ? "border-accent/30 bg-accent/[0.08] text-accent"
          : "border-red-500/20 bg-red-500/[0.05] text-red-300",
      )}
    >
      {label} {ok ? "✓" : "✕"}
    </span>
  );
}
