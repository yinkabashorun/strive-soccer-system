#!/usr/bin/env bash
# One screenshot of every screen of the iPhone app, taken in an iPhone
# simulator on GitHub's Mac (.github/workflows/ios-simulator-screens.yml).
# The app is the example-data build (EXPO_PUBLIC_FIXTURES=1): no account, no
# real player, nothing sent anywhere.
#
#   sim/shots.sh <simulator id> <path to StriveElite.app> <output folder>
#
# Each line of SHOTS is: name | which example member | screen | seconds to
# wait. The member is chosen by a launch argument (src/api/fixtures.ts); the
# screen is opened by the app's own link (striveelite://...). The app is
# reinstalled whenever the member changes, so nothing remembered from one
# member shows under the next.
set -uo pipefail
UDID="$1"; APP="$2"; OUT="$3"
BUNDLE="com.strivesoccer.elite"
mkdir -p "$OUT"

SHOTS='
01-sign-in|signedout|-|3
02-agreement|consent|-|3
03-door|onboarding|-|4
04-quiz-first|onboarding|onboarding/gender|3
05-quiz-team|onboarding|onboarding/team|3
06-quiz-on-ball|onboarding|onboarding/onBall|3
07-quiz-space|onboarding|onboarding/space|3
08-username|setup|-|3
09-photo|setup|profile-setup?edit=photo|3
10-gate|membership|-|3
11-home|ok|-|5
12-drop|ok|drop|4
13-session-count-in|ok|session/4|1
14-session-drill|ok|session/3|7
15-week|ok|week|4
16-you|ok|you|4
17-extra|ok|extra|4
18-checkin|ok|checkin|3
19-settings|ok|settings|3
20-change-password|ok|change-password|3
21-delete-account|ok|delete-account|3
'

last=""
fail=0
while IFS='|' read -r name state route wait; do
  [ -z "$name" ] && continue
  xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
  if [ "$state" != "$last" ]; then
    xcrun simctl uninstall "$UDID" "$BUNDLE" >/dev/null 2>&1
    xcrun simctl install "$UDID" "$APP" || { echo "install failed"; exit 1; }
    last="$state"
  fi
  if ! xcrun simctl launch "$UDID" "$BUNDLE" -fixtureState "$state" >/dev/null; then
    echo "MISSED $name: the app did not launch"; fail=1; continue
  fi
  sleep 6
  if [ "$route" != "-" ]; then
    xcrun simctl openurl "$UDID" "striveelite://$route" || echo "  (link striveelite://$route was refused)"
  fi
  sleep "$wait"
  if xcrun simctl io "$UDID" screenshot --type=png "$OUT/$name.png" >/dev/null 2>&1; then
    echo "saved $name"
  else
    echo "MISSED $name: no screenshot"; fail=1
  fi
done <<< "$SHOTS"
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
exit $fail
