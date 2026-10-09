"use client";

import { useEffect, useRef, useState } from "react";

// Autoplaying VSL from a direct video file (mp4/mov on a CDN).
//
// Sound, in order of what the browser allows (Oct 9 2026, Coach Yinka:
// "make it so they don't have to tap for sound"):
//   1. Try to start WITH sound. Desktop Chrome/Safari allow this for sites
//      the person has used before, and some in-app browsers allow it after
//      the tap that opened the link. If it works, no overlay at all.
//   2. If the browser refuses (iPhone Safari always does on a fresh load),
//      start muted so the picture is moving the instant the page opens,
//      and turn the sound on at the FIRST touch anywhere on the page, not
//      just on the video. A thumb landing anywhere, a scroll-tap, a tap on
//      the headline: sound comes on and the video restarts from 0:00.
//   3. The "Tap for sound" pill stays on the video as the obvious target
//      until that first touch.
// There is no way around step 2 on phones: audio needs one user gesture
// on the page, by browser policy, for every site on the internet.
//
// Orientation is read from the file itself, so a vertical upload gets a
// phone-width centered frame and a wide one goes full width.
export function VslFilePlayer({ src }: { src: string }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [unmuted, setUnmuted] = useState(false);
  const [portrait, setPortrait] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let cancelled = false;
    const onMeta = () => { setPortrait(v.videoHeight > v.videoWidth); setReady(true); };
    v.addEventListener("loadedmetadata", onMeta);

    const cleanupGesture: (() => void)[] = [];
    const soundOnFirstTouch = () => {
      // Any first interaction on the page unlocks audio; restart so they
      // hear it from the top (a VSL only works from the first line).
      const on = () => {
        if (cancelled) return;
        v.muted = false;
        v.volume = 1;
        v.currentTime = 0;
        v.play().catch(() => {});
        setUnmuted(true);
        off();
      };
      const off = () => {
        document.removeEventListener("pointerdown", on, true);
        document.removeEventListener("touchstart", on, true);
        document.removeEventListener("keydown", on, true);
      };
      document.addEventListener("pointerdown", on, true);
      document.addEventListener("touchstart", on, true);
      document.addEventListener("keydown", on, true);
      cleanupGesture.push(off);
    };

    // 1. sound first
    v.muted = false;
    v.volume = 1;
    v.play()
      .then(() => { if (!cancelled) setUnmuted(true); })
      .catch(() => {
        // 2. refused: muted now, sound at the first touch anywhere
        if (cancelled) return;
        v.muted = true;
        v.play().catch(() => {});
        soundOnFirstTouch();
      });

    return () => {
      cancelled = true;
      v.removeEventListener("loadedmetadata", onMeta);
      for (const off of cleanupGesture) off();
    };
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
