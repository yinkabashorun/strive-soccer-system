"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { setPlanDays } from "@/lib/elite/tracker-actions";
import { FREE_HOME } from "@/lib/elite/tracker";
import { DaysPicker } from "./DaysPicker";

// Changing the training days after the set-up: the same picker, saved on
// its own.
export function TrackerDays({ target, initial }: { target: number; initial: number[] }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  function save(days: number[]) {
    setError(null);
    start(async () => {
      const res = await setPlanDays(days);
      if (!res.ok) return setError(res.error);
      // A full load, so the week opens on the days just saved.
      window.location.assign(FREE_HOME);
    });
  }

  return (
    <div className="flex min-h-[calc(100svh-9rem)] flex-col">
      <div className="flex h-11 items-center">
        <Link
          href={FREE_HOME}
          className="-ml-2 inline-flex h-11 items-center gap-1 pl-1 pr-3 text-[15px] font-medium text-white/70"
        >
          <ChevronLeft className="h-5 w-5" /> Back
        </Link>
      </div>
      <DaysPicker
        target={target}
        initial={initial}
        submitLabel="Save"
        saving={saving}
        error={error}
        onSubmit={save}
      />
    </div>
  );
}
