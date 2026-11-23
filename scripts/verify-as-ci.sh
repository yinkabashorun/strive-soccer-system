#!/usr/bin/env bash
# Runs the site's checks and the iPhone app's checks the way GitHub and the
# TestFlight Mac see them: each in its own copy of the repository, with ONLY
# its own packages installed.
#
# Why: a working machine has both the site's packages (node_modules) and the
# app's (mobile/node_modules), so a file on one side that quietly leans on
# the other side's packages passes here and fails there. That happened twice
# on Nov 23 2026: the app's type check on the Mac (shared files looked for
# the site's packages), then a site test on GitHub and Vercel (it imported a
# file under mobile/, which needs the app's packages).
#
# Run before pushing anything that touches mobile/ or lib/elite:
#   bash scripts/verify-as-ci.sh
# Needs both sets of packages installed here (npm ci, and npm ci in mobile).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
[ -d node_modules ] || { echo "Install the site's packages first: npm ci" >&2; exit 1; }
[ -d mobile/node_modules ] || { echo "Install the app's packages first: (cd mobile && npm ci)" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir "$WORK/site" "$WORK/app"
git ls-files -co --exclude-standard | grep -v '^marketing/' > "$WORK/files.txt"
tar -cf - -T "$WORK/files.txt" 2>/dev/null | tar -xf - -C "$WORK/site"
tar -cf - -T "$WORK/files.txt" 2>/dev/null | tar -xf - -C "$WORK/app"
ln -s "$ROOT/node_modules" "$WORK/site/node_modules"
ln -s "$ROOT/mobile/node_modules" "$WORK/app/mobile/node_modules"

echo "== the site, with only the site's packages"
(cd "$WORK/site" && npx tsc --noEmit && npx vitest run)

echo "== the iPhone app, with only the app's packages"
(cd "$WORK/app/mobile" && CI=1 EXPO_NO_TELEMETRY=1 npm run verify)

echo "ok: both sides pass on their own packages"
