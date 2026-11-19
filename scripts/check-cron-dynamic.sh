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

# A cron route's database reads must never come from Next's fetch cache.
# force-dynamic does not prevent that (found Nov 12 2026: the plan builder
# read a cached "latest built week", rebuilt a live week every hour and
# texted the family each time). Every cron route must export both.
missing=""
for f in $(find app/api -path '*cron*' -name 'route.ts'); do
  grep -q 'export const dynamic = "force-dynamic"' "$f" || missing="$missing\n$f (dynamic)"
  grep -q 'export const fetchCache = "force-no-store"' "$f" || missing="$missing\n$f (fetchCache)"
done
if [ -n "$missing" ]; then
  echo "CRON ROUTE(S) WITHOUT force-dynamic + fetchCache force-no-store:"
  printf "$missing\n"
  exit 1
fi
echo "ok: every cron route reads the database fresh"

# Every server-side Supabase client must be built with freshFetch.
for f in lib/elite/supabase/server.ts lib/elite/supabase/middleware.ts lib/supabase.ts; do
  made=$(grep -cE 'createServerClient\(|createAdminClient\(|createClient\(url' "$f" || true)
  fresh=$(grep -c 'fetch: freshFetch' "$f" || true)
  if [ "$made" != "$fresh" ]; then
    echo "SUPABASE CLIENT WITHOUT freshFetch in $f ($made clients, $fresh with freshFetch)"
    exit 1
  fi
done
stray=$(grep -rlE '^import \{[^}]*create[A-Za-z]*Client[^}]*\} from "@supabase/(supabase-js|ssr)"' lib app middleware.ts --include=*.ts --include=*.tsx 2>/dev/null | grep -vE '^lib/elite/supabase/(server|middleware|client)\.ts$|^lib/supabase\.ts$' || true)
if [ -n "$stray" ]; then
  echo "SUPABASE CLIENT CREATED OUTSIDE THE SHARED FILES (add freshFetch there, or use the shared client):"
  echo "$stray"
  exit 1
fi
echo "ok: every server database client bypasses the fetch cache"
