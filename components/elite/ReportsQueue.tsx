"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dismissReports, removePost } from "@/lib/elite/tracker-actions";
import { fmtDuration } from "@/lib/elite/time-trained";
import { dayLabel, type ReportedPost } from "@/lib/elite/tracker";

// The coach's queue of reported posts (/coach/free): the photo, who posted
// it, who reported it and why. "Remove the post" takes it down for
// everyone and deletes the photo (the minutes stay in that player's week);
// "No action" closes the reports and leaves it up. The players who
// reported it keep it out of their feed either way.
export function ReportsQueue({ reports }: { reports: ReportedPost[] }) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const waiting = reports.filter((r) => !gone.has(r.log_id));

  function act(id: string, run: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await run();
      if (!res.ok) return setError(res.error ?? "That didn't go through. Try again.");
      setGone((g) => new Set([...g, id]));
      router.refresh();
    });
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-black uppercase tracking-tight">Reported posts</h2>
      {waiting.length === 0 ? (
        <p className="mt-2 text-sm text-white/60">Nothing to look at. A reported post shows up here, and you get a text.</p>
      ) : (
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {waiting.map((r) => (
            <li key={r.log_id} className="elite-card overflow-hidden">
              <div className="relative aspect-[4/5] bg-[#111]">
                {r.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photoUrl} alt={`Post by ${r.poster}`} className="h-full w-full object-cover" />
                ) : (
                  <p className="grid h-full place-items-center px-6 text-center text-sm text-white/60">
                    The photo could not be loaded. Remove the post if you are unsure.
                  </p>
                )}
              </div>
              <div className="p-4">
                <div className="font-semibold text-bone">{r.poster}</div>
                <div className="mt-0.5 text-sm text-white/60">
                  {dayLabel(r.day)} · {r.kind === "gym" ? "Gym" : "Training"} {fmtDuration(r.minutes)}
                  {r.caption ? ` · "${r.caption}"` : ""}
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {r.reports.map((rep, i) => (
                    <li key={i} className="text-white/70">
                      <span className="text-bone">{rep.reporter}</span>: {rep.reason}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(r.log_id, () => removePost(r.log_id))}
                    className="btn-accent h-11 disabled:opacity-60"
                  >
                    Remove the post
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(r.log_id, () => dismissReports(r.log_id))}
                    className="h-11 rounded-xl border border-white/15 text-sm font-semibold text-bone disabled:opacity-60"
                  >
                    No action
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
