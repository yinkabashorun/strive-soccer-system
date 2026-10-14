"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Video } from "lucide-react";
import type { Drill, ProgressVideo } from "@/lib/elite/types";
import { markProgressVideoPosted, setBenchmarkDrill } from "@/lib/elite/coach-actions";
import { cn, timeAgo } from "@/lib/utils";

// Coach side of the bi-weekly progress video (037): pick the benchmark
// drill, watch every clip by week, see whether the parent got the text
// and whether the family cleared it for the community, and mark it
// posted (posting to Skool is by hand; there is no Skool API).
export function ProgressVideosPanel({
  playerId,
  videos,
  benchmarkDrillId,
  fallbackTitle,
  bank,
}: {
  playerId: string;
  videos: ProgressVideo[];
  benchmarkDrillId: string | null;
  fallbackTitle: string | null; // the app's fallback when no pick is set
  bank: Drill[];
}) {
  const router = useRouter();
  const [pick, setPick] = useState<string>(benchmarkDrillId ?? "");
  const [pending, start] = useTransition();
  const skills = bank.filter((d) => d.active !== false && d.video_url && !/^(plyo|strength)/i.test(d.title));

  return (
    <div className="elite-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <Video className="h-3.5 w-3.5" /> Progress videos
        </div>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
      </div>

      <label className="block text-xs text-white/45">
        Benchmark drill, filmed on day one and every second week
        <select
          value={pick}
          onChange={(e) => {
            const v = e.target.value;
            setPick(v);
            start(async () => {
              await setBenchmarkDrill(playerId, v || null);
              router.refresh();
            });
          }}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-bone outline-none focus:border-accent/50"
        >
          <option value="">
            {fallbackTitle ? `Default: ${fallbackTitle}` : "Default: 8-cone freestyle"}
          </option>
          {skills.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </label>

      {videos.length === 0 ? (
        <p className="mt-4 text-sm text-white/40">
          No clips yet. The app asks for the first one on day one, then the same drill every second week.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {videos.map((v) => (
            <div key={v.id} className="border-t border-white/6 pt-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-bone">Week {v.week}</span>
                <span className="text-white/50">{v.drill_title}</span>
                <span className="text-xs text-white/35">{timeAgo(v.created_at)}</span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    v.share_ok ? "border-accent/40 text-accent" : "border-white/15 text-white/45"
                  )}
                >
                  {v.share_ok ? "OK to share" : "Private"}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-white/35">
                  {v.parent_sent_at ? "Parent texted" : "Parent not texted"}
                </span>
              </div>
              {v.clip_url ? (
                <video
                  src={v.clip_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="mt-2 aspect-[4/5] w-full max-w-[260px] rounded-xl bg-black object-cover"
                />
              ) : (
                <p className="mt-2 text-xs text-white/40">Clip unavailable right now.</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                {v.clip_url && (
                  <a href={v.clip_url} download className="text-white/60 underline-offset-2 hover:text-bone hover:underline">
                    Download
                  </a>
                )}
                {v.share_ok ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await markProgressVideoPosted(playerId, v.id, !v.posted_at);
                        router.refresh();
                      })
                    }
                    className="rounded-full border border-white/15 px-2.5 py-1 text-white/70 hover:border-white/30 disabled:opacity-50"
                  >
                    {v.posted_at ? "Posted to the community (undo)" : "Mark posted to the community"}
                  </button>
                ) : (
                  <span className="text-white/35">Not cleared for the community.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
