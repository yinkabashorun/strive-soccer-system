"use client";

import { useEffect, useRef, useState } from "react";

// Autoplaying VSL. Browsers (iOS Safari, Chrome) only allow autoplay with
// the sound off, so the video starts muted the moment the page opens and
// a "Tap for sound" layer sits on top. One tap restarts it from the top
// with audio, the way every VSL page does it. Uses the YouTube IFrame API
// so we can unmute + seek without a reload; falls back to a plain
// autoplay+mute embed if the API script never arrives.
type YTPlayer = {
  mute: () => void; unMute: () => void; setVolume: (v: number) => void;
  seekTo: (s: number, allowSeekAhead: boolean) => void; playVideo: () => void;
};
type YTPlayerCtor = new (
  el: HTMLElement,
  opts: { videoId: string; playerVars: Record<string, string | number>; events: { onReady: (e: { target: YTPlayer }) => void } }
) => YTPlayer;
declare global {
  interface Window {
    YT?: { Player?: YTPlayerCtor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function VslPlayer({ videoId }: { videoId: string }) {
  const host = useRef<HTMLDivElement | null>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [unmuted, setUnmuted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const create = () => {
      if (cancelled || !host.current || !window.YT?.Player) return;
      player.current = new window.YT.Player(host.current, {
        videoId,
        playerVars: {
          autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1,
          controls: 1, iv_load_policy: 3, origin: window.location.origin,
        },
        events: {
          onReady: (e) => { e.target.mute(); e.target.playVideo(); setReady(true); },
        },
      });
    };
    if (window.YT?.Player) create();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); create(); };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.async = true;
        s.onerror = () => setFailed(true);
        document.head.appendChild(s);
      }
    }
    const t = window.setTimeout(() => { if (!player.current) setFailed(true); }, 6000);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [videoId]);

  const tapForSound = () => {
    const p = player.current;
    if (!p) return;
    p.unMute();
    p.setVolume(100);
    p.seekTo(0, true);
    p.playVideo();
    setUnmuted(true);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-black">
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        {failed ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`}
            title="Strive Elite"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 h-full w-full [&>iframe]:h-full [&>iframe]:w-full">
            <div ref={host} />
          </div>
        )}
        {!unmuted && !failed ? (
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
    </div>
  );
}
