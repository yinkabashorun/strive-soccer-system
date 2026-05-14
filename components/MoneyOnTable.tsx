"use client";

import { motion } from "framer-motion";
import { ArrowRight, Banknote, TrendingUp } from "lucide-react";
import Link from "next/link";
import { dealValue, moneyOnTable, summerProgress } from "@/lib/pipeline";
import { formatCurrency } from "@/lib/utils";

export function MoneyOnTable() {
  const m = moneyOnTable();
  const s = summerProgress();
  const hottest = m.hottestLead;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="card relative overflow-hidden p-5"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="chip-accent">
              <Banknote className="h-3 w-3" />
              Money on the table
            </div>
            <h2 className="h-display mt-2 text-2xl font-semibold leading-tight">
              {formatCurrency(m.totalUncollected)}{" "}
              <span className="text-muted">uncollected</span>
            </h2>
            <p className="mt-1 text-xs text-muted">
              Across {m.uncollectedCount} open opportunities. Weighted forecast{" "}
              <span className="text-bone">
                {formatCurrency(m.weightedForecast)}
              </span>
              .
            </p>
          </div>
          <Link
            href="/pipeline"
            className="btn-accent text-xs"
            aria-label="Open pipeline"
          >
            Pipeline
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Bucket
            label="Promised"
            value={m.promisedDollars}
            tone="hot"
            note="said yes"
          />
          <Bucket
            label="Won · unpaid"
            value={m.wonUncollectedDollars}
            tone="money"
            note="verify cash"
          />
          <Bucket
            label="In flight"
            value={m.inFlightDollars}
            tone="cool"
            note="proposals out"
          />
        </div>

        {hottest && (
          <div className="mt-5 rounded-xl border border-accent/30 bg-accent/[0.06] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                Hottest lead
              </div>
              <TrendingUp className="h-3.5 w-3.5 text-accent" />
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <div>
                <div className="h-display text-lg font-semibold">
                  {hottest.contactName}
                </div>
                <div className="text-[11px] text-muted">
                  {hottest.stage} · {hottest.phone ?? "no phone"}
                </div>
              </div>
              <div className="h-display text-2xl font-semibold text-accent">
                {formatCurrency(dealValue(hottest))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-white/5 pt-4">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold uppercase tracking-[0.18em] text-muted">
              Summer · $47K target
            </span>
            <span className="tabular-nums text-bone">
              {formatCurrency(s.collected)} ·{" "}
              <span className="text-muted">
                {(s.pct * 100).toFixed(1)}%
              </span>
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft shadow-[0_0_12px_2px_rgba(229,255,61,0.5)]"
              style={{ width: `${Math.max(2, Math.min(100, s.pct * 100))}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted">
            <span>
              Need <span className="text-bone">{formatCurrency(s.weeklyBurnNeeded)}</span>/wk
            </span>
            <span>
              <span className="text-accent">{s.daysUntilSessions}d</span> to first session
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Bucket({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: number;
  tone: "hot" | "money" | "cool";
  note: string;
}) {
  const toneClass =
    tone === "hot"
      ? "text-accent"
      : tone === "money"
      ? "text-bone"
      : "text-muted";
  return (
    <div className="rounded-xl border border-white/5 bg-black/30 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className={`h-display mt-1.5 text-lg font-semibold tabular-nums ${toneClass}`}>
        {formatCurrency(value)}
      </div>
      <div className="text-[10px] text-muted">{note}</div>
    </div>
  );
}
