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
| 15 | A page opened in a sheet over the app that the app waits on (the card checkout from the offer): the sheet opens, Done closes it, and the app then asks the server what happened and moves on by itself, paid or not | test for the order of the calls; phone, with a real Stripe test card, for the rest |
| 16 | The iPhone's own sheets opened from a post or a button: the action sheet (Report this post, Block, Delete my post), the confirm box, and the share sheet (Send my link) all come up dark, and Cancel leaves everything as it was | phone |
| 17 | A photo from the library that is not a JPEG (the iPhone's own HEIC) is posted: the image tool turns it into a JPEG before it is sent, and the server takes it | phone; the simulator's flow picks a sample photo but the example build sends nothing |
| 18 | Two tab groups (a member's and the free app's): the tab bar shown is the right one for the account, and a tab with the same name in both (Courses) opens the one in the group being used | test for who sees which tabs; the simulator pictures for the rest |
| 19 | A drill ticked with no signal: it stays ticked, the finish and Week screens say it is saved on this phone, it survives the app being closed, and it reaches the coach side by itself when the signal is back | tests for the rules (`lib/elite/tick-outbox.ts`); phone, in airplane mode, for the rest |
| 20 | Clubs: the one-time sheet before a first "I'm in", before starting a club and before planning is the phone's own box, comes up dark, and "Not now" leaves everything as it was; "Invite a teammate" opens the share sheet with the club's code AND its link; a code typed in lower case, or a whole link pasted, is taken | tests for the words and the code rule; the simulator's flow (`sim/flows/09-clubs.yaml`) for the sheet and the code; phone for the share sheet |
| 21 | A tapped notification about a club's session or game opens that club's page, not Friends; with the app closed it does the same after sign-in is read | test for the address (`src/navigation.ts` pushRoute); phone, with a real push, for the rest (needs migration 087 applied) |
| 22 | Two crests on one screen (a game, the matchup, Clubs near you) each keep their own colours | the simulator pictures |

## What Coach Yinka checks on each new build

Sign in, the username and photo screen (camera and photos), Home, start a
session through to the finish ring, Week, Courses (open a course of drills,
tap a clip; open a course of pages and read down it), You, Settings. A screenshot or
screen recording of anything off is the fastest fix.

With a second email, the free side: Join free from the sign-in screen
(only there while free sign-up is switched on at /coach/free), the quiz,
the username and photo, the offer (the card shows the photo; "Not now,
start free"), the week's target and days, then Friends: post a photo from
the camera and one from the library, accept a friend request, give props,
Report and Block on a friend's post, Send my link. Week, Courses (every
course locked), You, Settings (Delete my account works for a free account).
Then, once Stripe is switched on: Start Strive Pro from the offer with a
test card, close the sheet, and the app should carry on to "You're in".

Clubs, with two free accounts on two phones: on the first, Clubs, Start a
club (the organizer sheet, a name, a county), then Invite a teammate and
send the code. On the second, Clubs, "Have a club code?", type the code,
"Ask to join". Back on the first, the club's page, Manage, Let in. Then the
captain plans a session (Manage, Plan a session), the second phone taps
"I'm in" (the player sheet, once), and both post a training photo and see
it under This week's photos. "How it works" on the matchup card opens the
six lines. The matchup card itself only fills once migration 083 is
applied and a Monday has passed.

## Notifications, on a phone only (rebuilt Nov 24 2026)

None of this can be seen in a simulator or a browser; each line is one check
on his iPhone, with notifications turned on and migration 088 applied.

1. **A tap opens the thing it is about.** A new week: Home. A medal (from
   the Inbox): You. A message from the coach: the Inbox, with the row "Reply
   on thestriveapp.com" under it. In the free app: a friend's post opens
   Friends, a club's session opens that club.
2. **From a closed app too.** Swipe the app away, tap a notification on the
   lock screen: the app opens on that screen, not on Home.
3. **Never past a gate.** Signed out (or with the agreement due), a tapped
   notification opens sign-in (or the agreement), and the screen it was
   about only after that.
4. **No number on the icon.** If an older build left one, opening the app
   clears it.
5. **Grouped.** Two notices about the week stack as one group on the lock
   screen, the coach's as another.
6. **Replaced, not piled.** Tomorrow's reminder takes the place of today's
   on the lock screen; a new week takes the place of last week's.
7. **Quiet at night.** A notice sent between 9:30 PM and 7:00 AM New York
   (the Monday week at 6:00 AM) is in the list in the morning and did not
   light the screen or make a sound.
8. **The website page in the sheet.** "Reply on thestriveapp.com" opens the
   messages page in the sheet over the app. The sheet has its own sign-in
   (it does not share the app's), so the first time it may ask for the
   password.
9. **The one question.** After the first finished session, say yes to
   notifications: "When do you usually train?" shows once, one tap answers
   it, and Settings, Notifications, Reminder time shows the answer.
10. **The switches.** Settings, Notifications, "Your week" off: no new-week
    push and no reminder on any phone of that account; the note is still in
    the Inbox.

The simulator run pictures the Inbox (18b) and taps through the bell, a
note and the choices (`mobile/sim/flows/11-inbox.yaml`) with example data.

## One app for free and Strive Pro, on a phone only (Nov 24 2026)

A free player who starts Strive Pro keeps every tab and gains one, Train
(`lib/elite/one-app.ts`). The rule and the screens are tested and pictured;
these are what only a phone shows.

1. **Train arrives without a restart.** On a free account, start Strive Pro
   (card, or an earned month). After "You're in" and the quiz's last
   screen, the bar reads Train, Friends, Week, Clubs, You, and the app is
   on Train. Friends still shows the same friends and posts, Clubs the
   same clubs.
2. **Five tabs fit.** No tab sits under a "More" button, on the smallest
   iPhone the app supports.
3. **A session counts once.** Finish a session on Train. Open Week: the
   time is on the ring and on the friends board, once. Tap "Post it to
   your friends" on the finish screen, add a photo: the time on Week does
   not change, and the post is in the Friends feed.
4. **Both kinds of notification arrive.** As a Pro member: a friend's post
   opens Friends, the new week opens Train.
5. **Train goes, the rest stays.** When Strive Pro ends, the bar is the
   four free tabs again, Week says so once ("Got it" puts it away), and
   every friend, post and club is still there.

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
