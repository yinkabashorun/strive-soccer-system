import { Check, Wrench } from "lucide-react";
import type { FilmReview } from "@/lib/elite/types";
import { cn } from "@/lib/utils";

// The deep film breakdown, rendered the same way for the player (inside
// FilmTimeline) and the coach (inside CoachFilmPanel after sending).
// Pure presentation - no state, no actions.
export function FilmReviewView({
  review,
  compact = false,
}: {
  review: FilmReview;
  compact?: boolean;
}) {
  const hasLists = review.strengths.length > 0 || review.fixes.length > 0;
  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {/* The big picture */}
      {review.summary && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            The big picture
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-white/85">
            {review.summary}
          </p>
        </div>
      )}

      {/* Timestamped key moments */}
      {review.moments.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Key moments
          </div>
          <ul className="mt-2 space-y-2">
            {review.moments.map((m, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3"
              >
                {m.time ? (
                  <span className="mt-0.5 shrink-0 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-accent">
                    {m.time}
                  </span>
                ) : (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                )}
                <span className="min-w-0 flex-1 text-sm leading-snug text-white/75">
                  {m.note}
                </span>
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                    m.kind === "good"
                      ? "bg-accent/90 text-black"
                      : "bg-red-500/85 text-white"
                  )}
                >
                  {m.kind === "good" ? "Keep" : "Fix"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What's working / what we're fixing */}
      {hasLists && (
        <div className="grid gap-4 sm:grid-cols-2">
          {review.strengths.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                What&apos;s working
              </div>
              <ul className="mt-2 space-y-1.5">
                {review.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/75">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={3} />
                    <span className="leading-snug">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {review.fixes.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                What we&apos;re fixing
              </div>
              <ul className="mt-2 space-y-1.5">
                {review.fixes.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/75">
                    <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
                    <span className="leading-snug">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Marching orders */}
      {review.next_steps.length > 0 && (
        <div className="rounded-2xl border border-accent/20 bg-accent/[0.05] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            Next steps
          </div>
          <ol className="mt-2 space-y-2">
            {review.next_steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="font-display text-lg font-black leading-none text-accent">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm leading-snug text-white/80">
                  {s}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
