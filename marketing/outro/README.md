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

## Site-build outro (5.0 s, 60 fps) - THE ONE TO USE

- strive-elite-outro-5s-vertical-1080x1920.mp4
- strive-elite-outro-5s-horizontal-1920x1080.mp4

A phone slides up and the /demo page constructs itself inside it: wordmark,
gold hairline, headline word by word, the four How-it-works cards sliding
in, four real drill tiles popping, then a CTA block ("Your player's first
week is waiting." / "Tell us about your player"), no price. The phone
recedes and the STRIVE ELITE end card lands with thestriveapp.com/demo.
Source: src/site-build-5s.html (timeline in the CSS at the top), sound:
src/sfx-site-5s.py -> src/site-5s.wav. Render with
  node render.mjs 1080 1920 60 5.0 sb-v 9333 site-build-5s.html
(src/site-build.html + sfx-site.py are the earlier 6.6 s cut with the
price block, kept as source only, no final committed.)
