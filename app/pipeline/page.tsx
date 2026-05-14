import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  Crosshair,
  Flame,
  Snowflake,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PipelineLeadCard } from "@/components/PipelineLeadCard";
import { OperatorBrief } from "@/components/OperatorBrief";
import {
  BUCKET_META,
  BUCKET_ORDER,
  dealValue,
  groupByBucket,
  moneyOnTable,
  summerProgress,
} from "@/lib/pipeline";
import { opportunities } from "@/lib/pipeline-data";
import type { OperatorBucket } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const BUCKET_ICON: Record<
  OperatorBucket,
  React.ComponentType<{ className?: string }>
> = {
  promised_uncollected: Banknote,
  won_uncollected: Banknote,
  signed_unpaid: AlertTriangle,
  needs_close: Flame,
  rescue_new: Crosshair,
  stale_followup: Snowflake,
  cooling: CalendarClock,
};

const BUCKET_TONE_RING: Record<OperatorBucket, string> = {
  promised_uncollected: "ring-accent/30 bg-accent/[0.04]",
  won_uncollected: "ring-accent/20 bg-accent/[0.03]",
  signed_unpaid: "ring-amber-400/20 bg-amber-400/[0.03]",
  needs_close: "ring-orange-400/30 bg-orange-400/[0.03]",
  rescue_new: "ring-red-500/30 bg-red-500/[0.04]",
  stale_followup: "ring-white/10 bg-white/[0.02]",
  cooling: "ring-white/10 bg-white/[0.02]",
};

export const dynamic = "force-dynamic";

export default function PipelinePage() {
  const grouped = groupByBucket(opportunities);
  const m = moneyOnTable();
  const s = summerProgress();
  const open = opportunities.filter((o) => o.status === "open").length;

  return (
    <div>
      <PageHeader
        eyebrow={`Pipeline · ${open} open · ${s.daysUntilSessions}d to first session`}
        title="Where the money actually is."
        subtitle="Every open opportunity, ranked by where a dollar arrives fastest. Sessions start May 20 — close or cut by then."
        actions={
          <>
            <a
              href="https://app.gohighlevel.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
            >
              Open in GHL
            </a>
            <a href="#brief" className="btn-accent">
              <Crosshair className="h-4 w-4" />
              Today's brief
            </a>
          </>
        }
      />

      {/* Money snapshot */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Uncollected"
          value={formatCurrency(m.totalUncollected)}
          hint={`${m.uncollectedCount} open opps`}
          tone="accent"
        />
        <Stat
          label="Promised"
          value={formatCurrency(m.promisedDollars)}
          hint="said yes · no money in"
        />
        <Stat
          label="Weighted forecast"
          value={formatCurrency(m.weightedForecast)}
          hint="probability-weighted"
        />
        <Stat
          label="Summer progress"
          value={`${(s.pct * 100).toFixed(1)}%`}
          hint={`${formatCurrency(s.collected)} of $47K`}
        />
      </div>

      {/* Operator brief */}
      <div id="brief" className="mt-6">
        <OperatorBrief />
      </div>

      {/* Buckets */}
      <div className="mt-8 space-y-8">
        {BUCKET_ORDER.map((bucket) => {
          const items = grouped[bucket];
          if (items.length === 0) return null;
          const meta = BUCKET_META[bucket];
          const Icon = BUCKET_ICON[bucket];
          const dollars = items.reduce((sum, o) => sum + dealValue(o), 0);

          return (
            <section
              key={bucket}
              className={`rounded-3xl p-1 ring-1 ${BUCKET_TONE_RING[bucket]}`}
            >
              <div className="rounded-[20px] bg-ink-100/70 p-5 backdrop-blur-sm">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.04] text-bone">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <h2 className="h-display text-xl font-semibold leading-none">
                        {meta.label}
                      </h2>
                      <span className="chip">{items.length}</span>
                    </div>
                    <p className="mt-2 max-w-xl text-xs text-muted">
                      {meta.blurb}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                        Bucket value
                      </div>
                      <div className="h-display text-lg font-semibold tabular-nums text-accent">
                        {formatCurrency(dollars)}
                      </div>
                    </div>
                    {bucket === "promised_uncollected" && (
                      <TrendingUp className="h-4 w-4 text-accent" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((o, i) => (
                    <PipelineLeadCard
                      key={o.id}
                      opportunity={o}
                      bucket={bucket}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "accent";
}) {
  return (
    <div className="card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div
        className={`h-display mt-1.5 text-2xl font-semibold tabular-nums ${
          tone === "accent" ? "text-accent" : "text-bone"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}
