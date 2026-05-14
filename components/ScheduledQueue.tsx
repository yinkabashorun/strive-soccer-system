import { CalendarRange, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { seedScheduledQueue, type QueueRow } from "@/lib/ghl-social";
import { cn } from "@/lib/utils";

const PILLAR_COLOR: Record<QueueRow["pillar"], string> = {
  "Ball Mastery": "bg-accent/15 text-accent border-accent/30",
  Mindset: "bg-blue-400/10 text-blue-300 border-blue-400/30",
  "Behind the Scenes": "bg-white/[0.04] text-bone border-white/10",
  "Player Spotlight": "bg-orange-400/10 text-orange-300 border-orange-400/30",
  Education: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  Offer: "bg-red-500/10 text-red-300 border-red-500/30",
};

const TODAY = new Date("2026-05-14T18:00:00Z");

export function ScheduledQueue() {
  const rows = seedScheduledQueue();
  const upcoming = rows.filter((r) => r.status !== "posted");
  const posted = rows.filter((r) => r.status === "posted");

  return (
    <section className="card relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-20 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="chip-accent">
              <CalendarRange className="h-3 w-3" />
              Scheduled queue · GHL Social Planner
            </div>
            <h2 className="h-display mt-2 text-2xl font-semibold leading-tight">
              The next 7 days, on autopilot.
            </h2>
            <p className="mt-1 text-xs text-muted">
              {upcoming.length} upcoming · {posted.length} posted · all
              TikTok via GHL. Edit or kill any post in GHL Social Planner.
            </p>
          </div>
          <a
            href="https://app.gohighlevel.com/social-planner"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            Open in GHL →
          </a>
        </div>

        <div className="mt-5">
          <Lane label="Upcoming" rows={upcoming} accent />
          <Lane label="Recently posted" rows={posted} />
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-white/10 p-3 text-[11px] text-muted">
          <span className="text-bone">Auto-generated.</span> Each row is a
          rotation slot. Today's pillar:{" "}
          <span className="text-accent">
            {rows.find((r) => sameDay(r.scheduledFor, TODAY))?.pillar ?? "—"}
          </span>
          .
        </div>
      </div>
    </section>
  );
}

function Lane({
  label,
  rows,
  accent = false,
}: {
  label: string;
  rows: QueueRow[];
  accent?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        <span>{label}</span>
        <div className="h-px flex-1 bg-white/5" />
        <span className="tabular-nums">{rows.length}</span>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className={cn(
              "group flex items-start gap-3 rounded-xl border p-3 transition-all",
              accent
                ? "border-white/5 bg-ink-200/40 hover:border-white/10"
                : "border-white/5 bg-black/20 opacity-80",
            )}
          >
            <div className="shrink-0">
              {r.status === "posted" ? (
                <CheckCircle2 className="h-4 w-4 text-accent" />
              ) : (
                <Circle className="h-4 w-4 text-muted" />
              )}
            </div>

            <div className="w-20 shrink-0 border-r border-white/5 pr-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                {formatDay(r.scheduledFor)}
              </div>
              <div className="h-display mt-0.5 text-sm font-semibold tabular-nums">
                {formatTime(r.scheduledFor)}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
                    PILLAR_COLOR[r.pillar],
                  )}
                >
                  {r.pillar}
                </span>
                <span className="text-[10px] text-muted">{r.platform}</span>
              </div>
              <div className="mt-1 truncate text-sm font-semibold">{r.hook}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted">
                {r.caption}
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold tabular-nums text-bone">
              <Sparkles className="h-2.5 w-2.5 text-accent" />
              {r.viralityScore}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function sameDay(iso: string, ref: Date) {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === ref.getUTCFullYear() &&
    d.getUTCMonth() === ref.getUTCMonth() &&
    d.getUTCDate() === ref.getUTCDate()
  );
}

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
