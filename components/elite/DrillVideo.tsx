"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Play, X } from "lucide-react";
import { drillPoster } from "@/lib/elite/drill-poster";

// Inline demo player for a drill card. Collapsed it shows the drill's
// still picture with a play badge: the poster made for every clip on our
// own domain (lib/elite/drill-poster.ts), or for a clip hosted elsewhere
// the video's own opening frame (#t=0.5 + preload=metadata). Tapping
// expands a framed player in place - portrait crop that keeps the ball
// work centered without swallowing the screen.
export function DrillVideo({ src, label = "Watch demo" }: { src: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const poster = drillPoster(src);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="relative mt-2 block w-full max-w-[170px] overflow-hidden rounded-xl border border-white/12 bg-black text-left transition-transform active:scale-[0.98]"
        aria-label={label}
      >
        {poster ? (
          <img
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            className="pointer-events-none aspect-[16/10] w-full object-cover opacity-90"
          />
        ) : (
          <video
            src={`${src}#t=0.5`}
            preload="metadata"
            muted
            playsInline
            aria-hidden
            tabIndex={-1}
            className="pointer-events-none aspect-[16/10] w-full object-cover opacity-90"
          />
        )}
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
            <Play className="ml-0.5 h-4 w-4 text-white" fill="currentColor" />
          </span>
        </span>
        <span className="pointer-events-none absolute bottom-1.5 left-2 text-[11px] font-semibold uppercase tracking-wider text-white/85">
          {label}
        </span>
      </button>
    );
  }

  return (
    <div className="relative mt-2 w-full max-w-[290px] overflow-hidden rounded-2xl border border-white/10 bg-black">
      <video
        src={src}
        poster={poster ?? undefined}
        controls
        autoPlay
        muted
        playsInline
        preload="metadata"
        className="aspect-[4/5] w-full object-cover"
      />
      <button
        onClick={() => setOpen(false)}
        className="absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-full text-white/80 hover:text-white"
        aria-label="Close video"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-black/60">
          <X className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}
