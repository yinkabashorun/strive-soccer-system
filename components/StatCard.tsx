"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// `icon` is a rendered ReactNode (e.g. <Sparkles className="h-4 w-4" />)
// rather than a component reference — RSCs can serialize JSX across the
// server→client boundary but not raw function references.
export function StatCard({
  label,
  value,
  delta,
  icon,
  hint,
  accent = false,
  index = 0,
}: {
  label: string;
  value: string;
  delta?: number;
  icon?: React.ReactNode;
  hint?: string;
  accent?: boolean;
  index?: number;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: "easeOut" }}
      className={cn(
        "card card-hover relative overflow-hidden p-5",
        accent && "border-accent/20 bg-gradient-to-br from-accent/[0.05] to-transparent"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
        </div>
        {icon && (
          <div className={cn("grid h-8 w-8 place-items-center rounded-lg", accent ? "bg-accent/10 text-accent" : "bg-white/[0.04] text-bone")}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <div className="h-display text-3xl font-semibold tracking-tight">
          {value}
        </div>
        {typeof delta === "number" && (
          <div
            className={cn(
              "mb-1 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              positive
                ? "bg-accent/10 text-accent"
                : "bg-red-500/10 text-red-300"
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta * 100).toFixed(0)}%
          </div>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </motion.div>
  );
}
