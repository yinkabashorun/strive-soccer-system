#!/usr/bin/env bash
# Fails the build if Next prerendered ANY cron route as static. A static
# cron route runs once at build time and then serves a frozen response to
# every real cron hit forever (found Oct 2 2026 on all three elite crons).
set -euo pipefail
cd "$(dirname "$0")/.."
bad=$(find .next/server/app/api -path '*cron*' -name '*.body' 2>/dev/null || true)
if [ -n "$bad" ]; then
  echo "STATIC CRON ROUTE(S) DETECTED - add: export const dynamic = \"force-dynamic\""
  echo "$bad"
  exit 1
fi
echo "ok: no cron route was prerendered as static"
