"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUSES = ["New", "Contacted", "Trial Booked", "Converted", "Lost"] as const;
type Status = (typeof STATUSES)[number];

export function LeadStatusPicker({
  leadId,
  initialStatus,
  compact = false,
}: {
  leadId: string;
  initialStatus: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<string>(initialStatus);
  const [saving, setSaving] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function update(next: Status) {
    if (next === status || saving) return;
    setSaving(next);
    setError(null);
    const previous = status;
    setStatus(next);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(previous);
        setError(data?.error ?? `update_failed (${res.status})`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setStatus(previous);
      setError(err instanceof Error ? err.message : "request_failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className={compact ? "flex flex-col gap-1.5" : "space-y-2"}>
      <div className={cn("flex flex-wrap gap-1.5", compact && "gap-1")}>
        {STATUSES.map((s) => {
          const active = s === status;
          const isSaving = saving === s;
          return (
            <button
              key={s}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                update(s);
              }}
              disabled={!!saving}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-60",
                active
                  ? "border-accent bg-accent text-black"
                  : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-bone",
              )}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : active ? (
                <Check className="h-3 w-3" />
              ) : null}
              {s}
            </button>
          );
        })}
      </div>
      {error && (
        <div className="text-[11px] text-red-300">Couldn't save: {error}</div>
      )}
    </div>
  );
}
