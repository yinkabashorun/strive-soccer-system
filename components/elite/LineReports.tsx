"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearPlayingFor, dismissLineReports } from "@/lib/elite/tracker-actions";
import type { ReportedLine } from "@/lib/elite/tracker";

// Reported "Playing for" lines, waiting for a coach: clear the line, or
// no action. Nothing here is shown to the player who reported it.
export function LineReports({ reports }: { reports: ReportedLine[] }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const rows = reports.filter((r) => !done.has(r.profile_id));
  if (rows.length === 0) return null;

  function act(id: string, run: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    start(async () => {
      const res = await run();
      if (!res.ok) return setError(res.error);
      setDone((d) => new Set(d).add(id));
      router.refresh();
    });
  }

  return (
    <section className="mt-8 max-w-2xl">
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">Reported profile lines</h2>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.profile_id} className="elite-card p-4">
            <p className="text-sm text-white/60">{r.player}</p>
            <p className="mt-1 text-[16px] font-semibold text-bone">Playing for &ldquo;{r.line}&rdquo;</p>
            <p className="mt-1 text-xs text-white/50">
              Reported by {r.reports.map((x) => x.reporter).join(", ")}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => act(r.profile_id, () => clearPlayingFor(r.profile_id))}
                className="h-11 rounded-lg border border-white/15 px-4 text-sm font-semibold text-bone disabled:opacity-60"
              >
                Clear the line
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => act(r.profile_id, () => dismissLineReports(r.profile_id))}
                className="h-11 rounded-lg px-4 text-sm text-white/70 disabled:opacity-60"
              >
                No action
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
