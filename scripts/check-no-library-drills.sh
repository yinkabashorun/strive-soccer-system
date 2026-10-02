#!/usr/bin/env bash
# Fails if a built-in (unfilmed) drill list ever comes back into the Elite
# app. Coach Yinka, Oct 2 2026: the only drills that exist are the filmed
# rows in the drill bank. The identifiers and string literals below are the
# exact ones that reached real players. Comment lines are ignored, so the
# history can still be written down; code cannot use them.
set -euo pipefail
cd "$(dirname "$0")/.."
pattern='PLYO_WARMUPS|plyoForSession|libraryDrills|METHOD_PILLARS\[[^]]*\]\.drills|"Plyo warm-up: (Pogo & Tuck|Lateral Power|Quick Feet|Explosive)"|"Apply under pressure"|"Perfect the detail"|title: "Focus block"'
hits=$(grep -rnE "$pattern" lib/elite 'app/(coach)' 'app/(player)' app/api/elite components/elite --include='*.ts' --include='*.tsx' 2>/dev/null | grep -vE '^[^:]+:[0-9]+:\s*//' || true)
if [ -n "$hits" ]; then
  echo "BUILT-IN DRILL CONTENT DETECTED - the only drills are the filmed bank rows:"
  echo "$hits"
  exit 1
fi
echo "ok: no built-in drill library in the Elite app"
