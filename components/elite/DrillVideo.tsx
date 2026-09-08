"use client";

import { useState } from "react";
import { PlayCircle, X } from "lucide-react";

// Inline demo player for a drill card. Tap to expand a framed player right
// in place: portrait crop that keeps the ball work centered without
// swallowing the screen, tap the X (or the button again) to collapse.
// preload="metadata" so a week full of videos costs nothing until tapped.
export function DrillVideo({ src, label = "Watch the demo" }: { src: string; label?: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
      >
        <PlayCircle className="h-4 w-4" /> {label}
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
