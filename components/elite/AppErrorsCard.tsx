import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { AppError } from "@/lib/elite/types";
import { summarizeAppErrors } from "@/lib/elite/app-errors";
import { cn, timeAgo } from "@/lib/utils";

// Every error page anyone has seen in the last 7 days, on the first
// screen the coach opens, next to the plan builder's card. Red when the
// last 24 hours had one. Oct 19 2026 the coach saw an error page after
// a publish and there was no record of it anywhere; now there is.
export function AppErrorsCard({ errors }: { errors: AppError[] }) {
  const s = summarizeAppErrors(errors);
  const bad = s.last24h > 0;
  const recent = errors.slice(0, 5);

  return (
    <div className={cn("elite-card p-5", bad && "border-red-400/30 bg-red-400/[0.05]")}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        App errors
        {bad ? (
          <AlertTriangle className="h-3.5 w-3.5 text-red-300" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
        )}
      </div>
      <p className={cn("mt-1.5 text-sm", bad ? "text-red-200" : "text-white/70")}>
        {bad
          ? `${s.last24h} in the last 24 hours, ${s.last7d} in the last 7 days.`
          : s.last7d > 0
            ? `None in the last 24 hours, ${s.last7d} in the last 7 days.`
            : "None in the last 7 days. Every error page a player, a parent or you ever sees lands here with its route and time."}
      </p>
      {recent.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-white/6 pt-3">
          {recent.map((e) => (
            <li key={e.id} className="text-xs">
              <div className="text-white/45">
                {timeAgo(e.occurred_at)} · {e.side} · {e.route || "/"} ·{" "}
                {e.viewer_role ?? "signed out"}
                {e.digest ? ` · ref ${e.digest}` : ""}
              </div>
              <div className="mt-0.5 break-words text-white/70">
                {e.message.length > 160 ? `${e.message.slice(0, 160)}...` : e.message}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
