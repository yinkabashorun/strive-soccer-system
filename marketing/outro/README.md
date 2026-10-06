# Strive Elite outro

ONE final, two orientations. Older cuts exist as source only.

## Site-build outro, 9 s (60 fps) - THE ONE TO USE

- strive-elite-outro-9s-vertical-1080x1920.mp4
- strive-elite-outro-9s-horizontal-1920x1080.mp4

A phone slides up into a soft gold glow and drifts in 3D (slow tilt) while
the /demo page constructs itself inside it: wordmark, gold hairline,
headline word by word, the four How-it-works cards sliding in, four real
drill tiles popping, then the CTA block ("Your player's first week is
waiting." / "Tell us about your player"), no price. A light sheen sweeps
across the glass, the phone recedes, and the STRIVE ELITE end card lands
with thestriveapp.com/demo. Audio is Nike-quiet: eight soft air swishes, no tones, peaks at -14 dBFS.
Source: src/site-build-9s.html, sound: src/sfx-site-9s.py -> src/site-9s.wav.
  node render.mjs 1080 1920 60 9.0 sb-v 9333 site-build-9s.html

## Earlier cuts (source kept, finals not committed)
- 5 s: src/site-build-5s.html + sfx-site-5s.py (same build, no tilt/sheen)
- 6.6 s with the price block: src/site-build.html + sfx-site.py
