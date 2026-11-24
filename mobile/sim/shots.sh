#!/usr/bin/env bash
# One screenshot of every screen of the iPhone app, taken in an iPhone
# simulator on GitHub's Mac (.github/workflows/ios-simulator-screens.yml).
# The app is the example-data build (EXPO_PUBLIC_FIXTURES=1): no account, no
# real player, nothing sent anywhere.
#
#   sim/shots.sh <simulator id> <path to StriveElite.app> <output folder>
#
# Each line of SHOTS is: name | which example member | screen | seconds to
# wait after launch. The member and the screen are both chosen by launch
# arguments (-fixtureState, -fixtureRoute: src/api/fixtures.ts). The
# simulator's "open this link" command is never used: iOS answers it with an
# "Open in Strive Elite?" box that stays up and covers every later picture.
# The app is reinstalled whenever the member changes, so nothing remembered
# from one member shows under the next.
#
# A fifth word, "film", also records the launch as a short video
# (<name>.mp4): a picture shows where a screen ended up, a video shows how it
# got there, and what moved after it. Kept to the screens that build
# themselves in (the door, the gate, Home, the week arriving, the offer and
# the free app's first screen).
#
# The example members: "ok" a member, "onboarding" a new member at the door
# (03-door: the member card with their photo), "setup" one who still owes
# the photo and @username, "locked" a FREE account in the free app (its
# five tabs; 21 is its Courses shelf), "free_quiz" a new free account at
# the quiz, "free_offer" one at the offer after it. 15-you is the member's
# card with the photo; 33 is the free account's You.
#
# Clubs (37 to 46), all the "locked" free account, every club made up
# (src/api/fixtures-clubs.ts): 37 the Clubs tab; 38 a club's page as a
# member, with this week's matchup under the club's week (filmed); 39 a
# club's page as its captain; 40 Manage, with a player asking to join, a
# game another club sent and a score to confirm; 41 Clubs near you; 42 the
# plan screen; 43 join by code; 44 the matchup's "How it works" sheet; 45 a
# club whose week is decided ("Your club won the week."); 46 Start a club.
#
# The 3, 2, 1 count-in is not here (a picture timed from launch would miss
# it); sim/flows/03-session.yaml takes it by tapping Start.
set -uo pipefail
UDID="$1"; APP="$2"; OUT="$3"
BUNDLE="com.strivesoccer.elite"
mkdir -p "$OUT"

SHOTS='
01-sign-in|signedout|-|9
02-agreement|consent|-|9
03-door|onboarding|-|12|film
04-quiz-first|onboarding|onboarding/gender|10
05-quiz-team|onboarding|onboarding/team|10
06-quiz-on-ball|onboarding|onboarding/onBall|10
07-quiz-space|onboarding|onboarding/space|10
08-username|setup|-|9
09-photo|setup|profile-setup?edit=photo|10
10-gate|membership|-|12|film
11-home|ok|-|11|film
12-drop|ok|drop|11|film
13-session-drill|ok|session/3|16
14-week|ok|week|11
14b-courses|ok|courses|12
14c-course-drills|ok|course/keep-it-up|14
14d-course-lessons|ok|course/general-nutrition-guide|12
15-you|ok|you|11
16-extra|ok|extra|11
17-checkin|ok|checkin|10
18-settings|ok|settings|10
19-change-password|ok|change-password|10
20-delete-account|ok|delete-account|10
21-courses-locked|locked|courses|12
22-join-age|signedout|join/age|9
23-join-name|signedout|join/name|9
24-join-agree|signedout|join/agree|9
25-free-start|free_quiz|-|11|film
26-free-quiz-grade|free_quiz|onboarding/grade|10
27-free-quiz-on-ball|free_quiz|onboarding/onBall|10
28-free-quiz-aim|free_quiz|onboarding/aim|10
29-offer|free_offer|-|13|film
30-week-plan|free_offer|week-plan|10
31-friends|locked|-|12|film
32-free-week|locked|my-week|12
33-free-you|locked|me|11
34-post|locked|post|10
35-offer-again|locked|offer|12
36-free-settings|locked|settings|10
37-clubs|locked|clubs|12
38-club|locked|club/c-renegados|13|film
39-club-captain|locked|club/c-pickup|13
40-club-manage|locked|club/c-pickup/manage|12
41-clubs-near|locked|club/c-pickup/near|12
42-club-plan|locked|club/c-pickup/plan|12
43-club-join|locked|club/join|10
44-matchup-how|locked|club/how|10
45-club-week-decided|locked|club/c-gainesville|13
46-club-start|locked|club/start|10
'

last=""
fail=0
while IFS='|' read -r name state route wait film; do
  [ -z "$name" ] && continue
  xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
  if [ "$state" != "$last" ]; then
    xcrun simctl uninstall "$UDID" "$BUNDLE" >/dev/null 2>&1
    xcrun simctl install "$UDID" "$APP" || { echo "install failed"; exit 1; }
    last="$state"
  fi
  args=(-fixtureState "$state")
  [ "$route" != "-" ] && args+=(-fixtureRoute "$route")
  rec=""
  if [ "$film" = "film" ]; then
    xcrun simctl io "$UDID" recordVideo --codec h264 --force "$OUT/$name.mp4" >/dev/null 2>&1 &
    rec=$!
    sleep 2
  fi
  if ! xcrun simctl launch "$UDID" "$BUNDLE" "${args[@]}" >/dev/null; then
    echo "MISSED $name: the app did not launch"; fail=1
    [ -n "$rec" ] && kill -INT "$rec" 2>/dev/null && wait "$rec" 2>/dev/null
    continue
  fi
  sleep "$wait"
  # the recording is closed by an interrupt, which is what writes the file
  [ -n "$rec" ] && kill -INT "$rec" 2>/dev/null && wait "$rec" 2>/dev/null
  if xcrun simctl io "$UDID" screenshot --type=png "$OUT/$name.png" >/dev/null 2>&1; then
    echo "saved $name"
  else
    echo "MISSED $name: no screenshot"; fail=1
  fi
done <<< "$SHOTS"
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
# What the app itself said while it ran (errors only, the last of them):
# a screen that never drew usually says why here.
xcrun simctl spawn "$UDID" log show --last 20m --style compact \
  --predicate 'process == "StriveElite" AND (messageType == error OR messageType == fault)' 2>/dev/null \
  | tail -n 400 > "$OUT/app-errors.txt" || true
exit $fail
