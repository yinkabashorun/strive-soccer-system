"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { runPlanBuilderNow } from "@/lib/elite/plan-builder-actions";
import type { CronRun } from "@/lib/elite/types";
import { cn } from "@/lib/utils";

// The plan builder's state, on the first screen the coach opens. The two
// outages this app has had were both silent - this makes the next one
// loud: a run that errored, a cron that stopped firing, a missing
// CRON_SECRET, or players sitting on a stale week all show up here in
// red, with a button that runs the builder right now.
export function PlanBuilderStatus({
  run,
  behind,
}: {
  run: CronRun | null;
  behind: string[]; // first names of players whose live week has no plan
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const ageMs = run ? Date.now() - new Date(run.ran_at).getTime() : Infinity;
  const stale = ageMs > 3 * 3600e3; // hourly cron, so 3h silent = dead
  const problems: string[] = [];
  if (!run) problems.push("The plan builder has never logged a run.");
  else {
    if (stale) problems.push(`No run for ${Math.round(ageMs / 3600e3)} hours. The hourly cron may be down in Vercel.`);
    if (run.errors.length)
      problems.push(`Last run had ${run.errors.length} error${run.errors.length === 1 ? "" : "s"}: ${run.errors.map((e) => `${e.name} (${e.error})`).join("; ")}`);
    if (!run.authed && run.trigger === "cron") problems.push("CRON_SECRET is not set in Vercel, so this route accepts any caller.");
  }
  if (behind.length) problems.push(`Training a stale week: ${behind.join(", ")}.`);
  const bad = problems.length > 0;

  function build() {
    setNote(null);
    start(async () => {
      const res = await runPlanBuilderNow();
      if (!res.ok) setNote("Not allowed.");
      else if (res.reason) setNote(`Could not run: ${res.reason}`);
      else setNote(`Built ${res.built} week${res.built === 1 ? "" : "s"}${res.errors ? `, ${res.errors} error${res.errors === 1 ? "" : "s"}` : ""}.`);
      router.refresh();
    });
  }

  return (
    <div className={cn("elite-card p-5", bad && "border-red-400/30 bg-red-400/[0.05]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            Plan builder
            {bad ? (
              <AlertTriangle className="h-3.5 w-3.5 text-red-300" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            )}
          </div>
          {run ? (
            <p className="mt-1.5 text-sm text-white/70">
              Last run {relative(ageMs)} ({run.trigger === "coach" ? "you" : "cron"}): {run.summary}.
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-white/70">No runs logged yet.</p>
          )}
          {problems.map((p) => (
            <p key={p} className="mt-1.5 text-sm text-red-200">
              {p}
            </p>
          ))}
          {note && <p className="mt-1.5 text-sm text-white/60">{note}</p>}
        </div>
        <button
          onClick={build}
          disabled={pending}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-bone transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Build missing weeks
        </button>
      </div>
    </div>
  );
}

function relative(ms: number): string {
  if (!Number.isFinite(ms)) return "never";
  const m = Math.round(ms / 60e3);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}
