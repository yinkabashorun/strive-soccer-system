#!/usr/bin/env bash
# One small still per drill clip on our own domain, so a drill shows its
# picture at once instead of a black box while the video loads (App Store
# punch list, A6).
#
#   bash scripts/make-drill-posters.sh          make the missing ones
#   bash scripts/make-drill-posters.sh --all    remake every one
#
# Reads public/drills/<name>.mp4, writes public/drills/posters/<name>.jpg:
# the frame half a second in (the first clear frame of a clip trimmed to
# the action), 540 px wide. The address rule is lib/elite/drill-poster.ts;
# tests/drill-poster.test.ts fails when a clip has no poster, so a new
# clip cannot ship without running this.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v ffmpeg >/dev/null || { echo "ffmpeg is needed to make posters" >&2; exit 1; }

all=0
[ "${1:-}" = "--all" ] && all=1
mkdir -p public/drills/posters
made=0
for clip in public/drills/*.mp4; do
  name="$(basename "$clip" .mp4)"
  out="public/drills/posters/$name.jpg"
  if [ "$all" -eq 0 ] && [ -s "$out" ]; then continue; fi
  ffmpeg -nostdin -loglevel error -y -ss 0.5 -i "$clip" -frames:v 1 \
    -vf "scale=540:-2" -q:v 11 "$out"
  made=$((made + 1))
done
# A poster whose clip is gone is removed.
for poster in public/drills/posters/*.jpg; do
  [ -e "$poster" ] || continue
  name="$(basename "$poster" .jpg)"
  [ -f "public/drills/$name.mp4" ] || rm -f "$poster"
done
echo "posters made: $made, total: $(ls public/drills/posters/*.jpg 2>/dev/null | wc -l | tr -d ' ')"
