# Strive Elite outro (3.6 s, 30 fps, sound bed included)

Finals:
- strive-elite-outro-vertical-1080x1920.mp4  (Reels / TikTok / Stories)
- strive-elite-outro-horizontal-1920x1080.mp4 (YouTube / VSL / landscape)

Sequence: gold line sweeps across (whoosh), the ball mark lands (soft
thump), STRIVE ELITE resolves with tightening tracking (two-note chime),
gold rule and "Weekly at-home training" (two light ticks),
thestriveapp.com fades in, hold, fade to black over the last 0.45 s.
Brand: #0d0d0d, Barlow Condensed 900, gold #c8a858 on ELITE, the rule,
the sweep and the eyebrow only.

Rebuild (src/):
  node render.mjs 1080 1920 30 3.6 frames-v 9333   # frames via headless Chrome CDP
  python3 sfx.py outro.wav                           # synthesized SFX (numpy)
  ffmpeg -framerate 30 -i frames-v/f%04d.jpg -i outro.wav -c:v libx264 \
    -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart out.mp4
ffmpeg from `pip install imageio-ffmpeg` (the Playwright one has no x264/aac).
Frame folders are not committed.

## Site-build outro, 9 s (60 fps) - THE ONE TO USE

- strive-elite-outro-9s-vertical-1080x1920.mp4
- strive-elite-outro-9s-horizontal-1920x1080.mp4

A phone slides up into a soft gold glow and drifts in 3D (slow tilt) while
the /demo page constructs itself inside it: wordmark, gold hairline,
headline word by word, the four How-it-works cards sliding in, four real
drill tiles popping, then the CTA block ("Your player's first week is
waiting." / "Tell us about your player"), no price. A light sheen sweeps
across the glass, the phone recedes, and the STRIVE ELITE end card lands
with thestriveapp.com/demo. Every cue has a sound.
Source: src/site-build-9s.html, sound: src/sfx-site-9s.py -> src/site-9s.wav.
  node render.mjs 1080 1920 60 9.0 sb-v 9333 site-build-9s.html

## Earlier cuts (source kept, finals not committed)
- 5 s: src/site-build-5s.html + sfx-site-5s.py (same build, no tilt/sheen)
- 6.6 s with the price block: src/site-build.html + sfx-site.py
