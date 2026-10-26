# Strive Elite outro

ONE final, two orientations. Older cuts exist as source only.

## Site-build outro, 9 s (60 fps) - THE ONE TO USE

- strive-elite-outro-9s-vertical-1080x1920.mp4
- strive-elite-outro-9s-horizontal-1920x1080.mp4

A phone slides up into a soft gold glow and drifts in 3D (slow tilt) while
the /demo page constructs itself inside it: wordmark, gold hairline,
headline word by word, two How-it-works cards sliding in, four real drill
tiles popping (Ball Mastery, Passing, Keep It Up, 1v1 Skills), then the
offer block: $249/mo, gold rule, "Locked for life if you join by Nov 1.
$500/mo from Nov 2.", button DM us "ELITE". A light sheen sweeps across
the glass, the phone recedes, and the STRIVE ELITE / PERSONALIZED TRAINING
end card lands with thestriveapp.com/demo. Audio: three short swishes
(phone in, offer lands, end card), silence between, peaks at -14 dBFS.
Source: src/site-build-9s.html, sound: src/sfx-site-9s.py -> src/site-9s.wav.
Tiles: tile-ball-mastery.jpg is ball-mastery-juggle-catch.mp4 at 5.0 s,
tile-keep-it-up.jpg is juggling-thighs-high.mp4 at 4.75 s (both from
public/drills, 720x720 crops). tile-confidence.jpg is only used by the
older cuts now.
  node render.mjs 1080 1920 60 9.0 sb-v 9333 site-build-9s.html
  node render.mjs 1920 1080 60 9.0 sb-h 9334 site-build-9s.html
  ffmpeg -framerate 60 -i sb-v/f%04d.jpg -i site-9s.wav -c:v libx264 -preset slow -crf 18 \
    -pix_fmt yuv420p -c:a aac -b:a 128k -ar 48000 -shortest -movflags +faststart ../strive-elite-outro-9s-vertical-1080x1920.mp4
render.mjs finds Chrome from CHROME or the Playwright installs it has run on.

## Earlier cuts (source kept, finals not committed)
- 5 s: src/site-build-5s.html + sfx-site-5s.py (same build, no tilt/sheen)
- 6.6 s with the price block: src/site-build.html + sfx-site.py
