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
| 1 | A screen with a text field moves out of the keyboard's way, scrolls, puts the keyboard away on a tap of empty space or a drag, and its buttons work on the first tap | `src/FormScreen.tsx`, the only place the keyboard is handled; `tests/app-device.test.ts` |
| 2 | Next on a field moves to the next field; Go submits | test for sign-in; phone for the rest |
| 3 | A file is sent as bytes, never as a FormData file part and never by fetching a file on the phone (this Expo version's fetch refuses both) | `src/multipart.ts`; test sends it through the server's own parser |
| 4 | The camera, photos and notifications are asked for before they are used; a no is said plainly with a way to Settings; the rest still works | test for the camera; phone for notifications |
| 5 | Before using a library call, read the installed version's own source for what it accepts, not memory of an older version | habit; the record names each miss |
| 6 | Nothing sits under the notch, the home bar or the tab bar | phone |
| 7 | Every tap answers at once (press state), a slow call shows it is working, a failed call says what to do | phone |
| 8 | No signal: the last screen still shows, and the message says so | phone |
| 9 | Swipe back works on every pushed screen and never leaves a gate | phone |
| 10 | Sound, vibration and the screen staying awake in a session | phone |
| 11 | Larger text sizes and reduced motion do not break a screen | phone |

## What Coach Yinka checks on each new build

Sign in, the username and photo screen (camera and photos), Home, start a
session through to the finish ring, Week, You, Settings. A screenshot or
screen recording of anything off is the fastest fix.

## Not built: seeing the phone from here

A check on GitHub's Mac that opens the app in an iPhone simulator, taps
through these screens with example data and saves screenshots would let the
screens be seen before a build is sent. Proposed Nov 23 2026; his call.
