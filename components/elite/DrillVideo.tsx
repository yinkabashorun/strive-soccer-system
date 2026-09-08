"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";

// Inline demo player for a drill card. Collapsed it shows a real thumbnail
// (the video's own opening frame via #t=0.5 + preload=metadata) with a play
// badge; tapping expands a framed player in place - portrait crop that
// keeps the ball work centered without swallowing the screen.
export function DrillVideo({ src, label = "Watch demo" }: { src: string; label?: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="relative mt-2 block w-full max-w-[170px] overflow-hidden rounded-xl border border-white/12 bg-black text-left transition-transform active:scale-[0.98]"
        aria-label={label}
      >
        <video
          src={`${src}#t=0.5`}
          preload="metadata"
          muted
          playsInline
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none aspect-[16/10] w-full object-cover opacity-90"
        />
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
            <Play className="ml-0.5 h-4 w-4 text-white" fill="currentColor" />
          </span>
        </span>
        <span className="pointer-events-none absolute bottom-1.5 left-2 text-[10px] font-semibold uppercase tracking-wider text-white/85">
          {label}
        </span>
      </button>
    );
  }

  return (
    <div className="relative mt-2 w-full max-w-[290px] overflow-hidden rounded-2xl border border-white/10 bg-black">
      <video
        src={src}
        controls
        autoPlay
        playsInline
        preload="metadata"
        className="aspect-[4/5] w-full object-cover"
      />
      <button
        onClick={() => setOpen(false)}
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white/80 hover:text-white"
        aria-label="Close video"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
