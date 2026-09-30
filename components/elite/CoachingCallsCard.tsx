import { Video } from "lucide-react";
import type { CoachingCall } from "@/lib/elite/types";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

// Player-side: the next 1:1 call with Coach, and the join link. Complete
// Pathway only - the dashboard never renders this for an Elite player.
export function CoachingCallsCard({ calls }: { calls: CoachingCall[] }) {
  const now = Date.now();
  const next = [...calls]
    .filter((c) => new Date(c.scheduled_at).getTime() >= now)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const done = calls.filter((c) => new Date(c.scheduled_at).getTime() < now).length;

  return (
    <div className="rounded-3xl border border-accent/20 bg-accent/[0.05] p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
        <Video className="h-3.5 w-3.5" /> Your coaching call
      </div>
      {next ? (
        <>
          <p className="mt-1.5 font-medium text-bone">{fmt(next.scheduled_at)}</p>
          <p className="mt-0.5 text-sm text-white/55">
            With {next.coach_name || "Coach"}. Come with your questions.
          </p>
          {next.join_url && (
            <a
              href={next.join_url}
              target="_blank"
              rel="noreferrer"
              className="btn mt-3 inline-flex px-5 py-2 text-sm"
            >
              Join on Zoom
            </a>
          )}
        </>
      ) : (
        <p className="mt-1.5 text-sm text-white/55">
          {done > 0
            ? "Your next call will show up here once it's booked."
            : "Coach will book your first call. It'll show up here."}
        </p>
      )}
      {done > 0 && (
        <p className="mt-3 text-xs text-white/35">
          {done} call{done === 1 ? "" : "s"} completed so far.
        </p>
      )}
    </div>
  );
}
