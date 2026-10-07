"use client";

import { useEffect, useRef, useState } from "react";

// Autoplaying VSL from a direct video file (mp4/mov on a CDN). Starts muted
// the instant the page opens (the only autoplay phones allow) with a
// "Tap for sound" layer on top; one tap restarts from 0:00 with audio and
// shows normal controls. Orientation is read from the file itself, so a
// vertical upload gets a phone-width centered frame and a wide one goes
// full width.
export function VslFilePlayer({ src }: { src: string }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [unmuted, setUnmuted] = useState(false);
  const [portrait, setPortrait] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const onMeta = () => { setPortrait(v.videoHeight > v.videoWidth); setReady(true); };
    v.addEventListener("loadedmetadata", onMeta);
    v.muted = true;
    v.play().catch(() => {});
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [src]);

  const tapForSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    v.currentTime = 0;
    v.play().catch(() => {});
    setUnmuted(true);
  };

  const frame = portrait
    ? "relative mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/8 bg-black"
    : "relative overflow-hidden rounded-2xl border border-white/8 bg-black";

  return (
    <div className={frame}>
      <video
        ref={video}
        src={src}
        className="block h-auto w-full"
        autoPlay
        muted
        playsInline
        preload="auto"
        controls={unmuted}
      />
      {!unmuted ? (
        <button
          type="button"
          onClick={tapForSound}
          aria-label="Tap for sound"
          className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/35"
        >
          <span className="flex items-center gap-3 rounded-full border border-white/25 bg-black/70 px-6 py-3.5 font-display text-base font-black uppercase tracking-wider text-white backdrop-blur-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            {ready ? "Tap for sound" : "Loading"}
          </span>
        </button>
      ) : null}
    </div>
  );
}
