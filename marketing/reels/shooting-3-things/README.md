# Shooting: three things (reel, Oct 28 2026)

Built with the `strive-reel` skill (.claude/skills/strive-reel/SKILL.md),
which holds the house style and the rules. This folder is one reel:

- spec.json: the names and timings, keep_hook true (Coach Yinka's own
  "Score 5x More Goals In 30 Seconds" title stays exactly as he shot it).
- faces.json: the face track from faces.py on the zoom-only pass.
- overlays.ass / endcard.ass: what the builder wrote.
- fonts/: the brand TTFs (converted from marketing/outro/src/fonts).
- strive-shooting-3-things.mp4: the finished reel, 1080x1920, 30 fps, 14.9 s.

What is on it: the 01 / 02 / 03 list (Chest over the ball, Strike with
the laces, Head over the ball) building up top-right in the compact
inline layout, the only spot on this clip that his face never reaches; a
small punch-in on each; the STRIVE ELITE / PERSONALIZED REMOTE TRAINING
watermark bottom-right; the 2.4 s end card with the outro swish. No
captions: Coach Yinka adds his own.

Rebuild: `python3 ../../../.claude/skills/strive-reel/reel_build.py spec.json`
from this folder (set `src` to the clip first; the source is not kept
in the repo).
