# The native iPhone app: what only a real phone shows

Opened Nov 23 2026, after Coach Yinka's first run of the native app found
three faults that no check here could see (the profile photo never left the
phone, the camera never opened, the sign-in keyboard could not be put away).

The cause behind all three: the app is written and checked without a phone.
The screens are looked at in a browser at iPhone size, where there is no
keyboard, no camera, no permission prompt and a different network layer.
So every screen is held to this list when it is written, and each line says
how it is checked: a test that fails the build, or Coach Yinka's phone.

| # | On a real phone | How it is held |
|---|---|---|
| 1 | The box being typed in is in view above the keyboard (in a sheet too), the page scrolls, the keyboard goes away on a tap of empty space or a drag, and buttons work on the first tap | `src/FormScreen.tsx`, the only place the keyboard is handled; `tests/app-device.test.ts`; the simulator's typing flows |
| 2 | Next on a field moves to the next field; Go submits | test for sign-in; phone for the rest |
| 3 | A file is sent as bytes, never as a FormData file part and never by fetching a file on the phone (this Expo version's fetch refuses both) | `lib/elite/upload-body.ts`; test sends it through the server's own parser |
| 4 | The camera, photos and notifications are asked for before they are used; a no is said plainly with a way to Settings; the rest still works | test for the camera; phone for notifications |
| 5 | Before using a library call, read the installed version's own source for what it accepts, not memory of an older version | habit; the record names each miss |
| 6 | Nothing sits under the notch, the home bar or the tab bar; a tab's page leaves that room once, in `src/Screen.tsx` | test; the simulator pictures |
| 7 | Every tap answers at once (press state), a slow call shows it is working, a failed call says what to do | phone |
| 8 | No signal: the last screen still shows; with nothing saved, the first screen says so with Try again (`src/Holding.tsx`) | test for the first screen; phone for the rest |
| 9 | Swipe back works on every pushed screen and never leaves a gate | phone |
| 10 | Sound, vibration and the screen staying awake in a session | phone |
| 11 | Larger text sizes and reduced motion do not break a screen | phone |
| 12 | The status bar reads on every screen and the phone's own boxes are dark: the app is dark whatever the phone is set to | test; the simulator pictures |
| 13 | The first screen is the right one: nothing of Home shows before a member who belongs elsewhere is sent there, and the launch screen never stays up more than a few seconds | test; the simulator's launch videos |
| 14 | A screen that builds itself in ends up complete: watch it move, not only where it stopped | the simulator's launch videos (`film` in `sim/shots.sh`) |

## What Coach Yinka checks on each new build

Sign in, the username and photo screen (camera and photos), Home, start a
session through to the finish ring, Week, Courses (open a course of drills,
tap a clip; open a course of pages and read down it), You, Settings. A screenshot or
screen recording of anything off is the fastest fix.

## Seeing the phone from here

`.github/workflows/ios-simulator-screens.yml` (built Nov 23 2026 on his
"do the github"): on every change to `mobile/` on a working branch, GitHub's
Mac builds the app with example data, opens it in an iPhone simulator and
saves a picture of every screen (`mobile/sim/shots.sh`), films the launch of
the screens that build themselves in, then taps and types through the
keyboard screens and a whole session (`mobile/sim/flows/`). The pictures and
videos land on the `app-screens` branch and as the run's download.

Each screen is opened by a launch argument, never by a link: iOS answers the
simulator's "open this link" with a box that stays on screen.

Read them before asking for a TestFlight build. It does not show the
camera, notifications, sound or vibration: lines 4 and 10 stay his phone's.
