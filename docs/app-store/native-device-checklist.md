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

## The last step of joining free, on a phone only (Nov 25 2026)

1. **Start my week opens the app.** Join free with a new email, take the
   quiz, add the photo, tap "Not now, start free", pick the days, tap
   "Start my week". The app opens on Friends with "Start training". It
   must not stay on "Your week" with a Save button (builds 8 and 9 did).
2. **Nothing behind it.** On Friends, swipe from the left edge: nothing
   happens. The offer and the week's set-up are not behind the app.
3. **Changing it later still closes.** Week tab, Change, move a day, Save:
   back on Week with the new days.

## Build 9 and later, on a phone only (Nov 25 2026)

1. **A face opens a profile.** On Friends, tap a friend's face in the row,
   then the face on a post, then a row of the friends board on Week, then a
   member in a club. Each opens that player's profile (their card, clubs,
   training photos) and Back returns to where you were. Your own face does
   nothing.
2. **The profile's menu.** The three dots open the iPhone's own sheet:
   report the photo, remove from my friends, block. Cancel closes it.
   After Block, the player is gone from Friends, and Settings, Blocked
   players lists them with Unblock.
3. **You shows your clubs and photos.** Under your card: your clubs, then
   your own training photos, the time on each.
4. **Saved passwords.** Sign out. On the sign-in screen, tap the email
   box: the keyboard offers the saved login for thestriveapp.com (it has to
   be saved in the phone's Passwords, e.g. from Safari). After signing in
   with a typed password, the phone offers to save it. If neither happens,
   say so: it means the phone has not linked the app and the site yet (it
   can take a day after the first install of a build that has it).
5. **The icon.** On the home screen the Strive logo is sharp and whole
   inside the white coin.
6. **The build number.** Settings ends with "Strive Elite 1.0.0 (9)": the
   number in brackets is the build that is installed.
7. **The post screen names who is waiting.** Before you post today, with a
   friend who trained: their faces and "Post yours to see theirs."

## Share my week, on a phone only (Nov 25 2026)

One row under the friends board on Week, once the player has trained this
week (`mobile/src/ShareWeekRow.tsx`). The server draws the picture
(`lib/elite/week-card-image.ts`, tested and looked at); the phone writes it
to a file and opens the share sheet. None of that has run on a phone.

1. **The sheet opens with the picture.** Tap "Share my week". After a
   moment the phone's share sheet opens with a tall black card as its
   preview: the name, the gold ring with the time, the seven days.
2. **Instagram takes it as a story.** Instagram is in the sheet; pick it,
   then Story. The card fills the story, nothing important under
   Instagram's own bars at the top and bottom.
3. **Save Image works** and the saved picture is sharp (1080 x 1920).
4. **With no connection** the row says "We could not reach Strive. Check
   your connection and try again." and nothing opens.
5. **The words.** The sheet is handed the picture alone, on purpose: a
   story takes a picture, not a picture with a line of text, and a sheet
   only offers apps that take everything it is given. The player's own
   link ("Train with me: ...") goes out only when the picture could not
   be made. If the words should ride with the picture, set
   `SHARE_WEEK_WORDS_WITH_PICTURE` in `mobile/src/share-week.ts` to true
   on a test build and check that Instagram is still in the sheet.

## The training clock, on a phone only (Nov 25 2026)

Training in the free app is timed between two photos (his "a pic when they
arrive then when they dip"). The simulator has no camera, so in its
pictures the phone's own photos stand in; ONLY A PHONE PROVES the camera,
the locked phone and a field with no signal. Needs a build made after the
clock is on main, and migration 089 applied.

1. **The camera, and only the camera.** Friends, "Start training", "Take
   my start photo": the camera opens (after the one-time permission
   question). There is no way to pick a photo from the library, for the
   start or the finish.
2. **Camera turned off.** With the camera switched off for Strive Elite in
   the phone's Settings, the button says so in one line with "Open
   Settings", and nothing else happens.
3. **The clock runs with the phone locked.** Take the start photo, lock
   the phone for five minutes, unlock: the clock shows five minutes more,
   at once, not a clock that starts catching up.
4. **The clock survives the app being closed.** Start a clock, swipe the
   app away, open it again: Friends and Week both show the clock row at
   the top, still counting; one tap opens it.
5. **The finish.** "Take my finish photo", then the screen shows the
   finish photo with the start photo in its corner, "Ready to post" and
   the time between the two. There is nothing to pick a length with.
   Type a note: the Post button stays above the keyboard.
6. **Under a minute.** Start a clock and tap the finish straight away: one
   line says the clock has been running for under a minute, and the
   camera does not open.
7. **NO SIGNAL (the one that matters at a field).** Turn on airplane mode.
   Start a clock, wait two minutes, take the finish photo, tap "Post to my
   friends". It says "Your training is saved on this phone. Post it when
   you are back online." Close the app. Turn airplane mode off, open the
   app: the row on Friends says "Ready to post"; tap it, post. The time on
   the post is the two minutes between the photos, not the time it waited.
8. **Posting twice does nothing twice.** On weak signal tap Post, and tap
   it again if it seems stuck: one post, one entry on the week.
9. **Stop without posting.** Start a clock, "Stop without posting", confirm:
   the row is gone and nothing is on the week.
10. **Friends see both photos.** A friend's phone shows the post with the
    start photo small in the corner of the finish photo.
11. **Without the clock.** "Trained without the clock?", pick 45m, "Add it
    to my week": it is on the Week tab's list marked "Not timed", the ring
    moves, and the friends board and the club's time do not.
13. **One tap to the camera.** After the first clock ever, "Start
    training" on Friends opens the camera at once (the screen behind it
    is the start screen). With a clock running, "Finish my training" and
    the clock's row open the camera at once too. Closing the camera
    leaves the clock's screen, nothing lost. IF THE CAMERA DOES NOT COME
    UP BY ITSELF, tell me: the button on the screen still works, and the
    wait before it opens is one number (CAMERA_AFTER_MS in app/post.tsx).
14. **The post sends itself.** Repeat check 7, but after tapping Post in
    airplane mode do NOT open the clock again: turn airplane mode off and
    just open the app. Within a few seconds the row is gone and the post
    is on Friends.
15. **Forgot to stop the clock.** On "Ready to post" tap "Finished before
    you took this photo?", then "5 min less" twice: the time drops ten
    minutes; "5 min more" brings it back and never goes above the
    measured time. The post shows the lower time.
12. **A clock nobody finished.** Not worth waiting three hours for on a
    phone: the simulator's pictures and the tests hold it. If it ever
    shows ("This one was not timed"), both buttons clear it.

## The door, champs of the week and the clock's own notice, on a phone only (Nov 26 2026)

His three calls of Nov 26. Needs a build made after they are on main. The
door's "straight to my friends" and the champs notification also need
migration 090 applied; until then a code still asks and the quiz comes
next, and no champs notification is sent.

THE DOOR ("Have a code from a teammate or a club?")

1. **The order.** Join free with a new email: after "Create my account"
   comes the username, then the photo, THEN the code question. Not the
   quiz first.
2. **No code.** Tap "I do not have a code": "tell us about your game",
   Start, the quiz, the offer, "Your week", Friends. Exactly as before.
   Close the app and open it again mid-quiz: the code question does not
   come back.
3. **The keyboard.** On the code question tap the box: both buttons ("Use
   my code", "I do not have a code") sit above the keyboard. Tap "Use my
   code" with the box empty: one line says what a code looks like.
4. **A teammate's code.** On a second phone (or the website) open Friends,
   "Send my link": the message now carries "My code: XXXXXXXX" and the
   link. Type that code at the door on the new account: "Request sent. You
   and <name> are friends once <name> accepts.", then "Go to my friends"
   opens Friends. No quiz, no offer, no "Your week". The first phone has
   the friend request to accept.
5. **A club's code.** The same with a club's code (the club page, "Invite
   a teammate": "Club code: XXXXXXXX"): the captain's phone has the
   request under Manage; once let in, the club is on the new player's
   Clubs tab.
6. **Paste the whole invite.** Paste the whole shared message (words, code
   and link) into the box: it is read the same as the code alone.
7. **A wrong code.** Eight characters that are nobody's: "That code did
   not match a teammate or a club. Check it and try again." Your own code:
   it says it is your own.
8. **The week of a player who came in by a code.** Week shows a 4 hour
   target and "Change your target and days" works. No Training / Gym
   choice until the quiz's grade is answered.
9. **The quiz, later.** On Week the one card reads "A week built around
   your game." Tap "See what you get": the quiz opens with a Close in the
   corner. Finish it: the offer shows, and "Not now" lands back in the
   free app, NOT on "Your week". THIS IS THE STEP ONLY A PHONE PROVES (the
   quiz closes and the offer opens in one move); if it lands anywhere
   else, tell me where.
10. **Never again.** Sign out and back in on that account: no code
    question.

GAMES BETWEEN CLUBS ARE NOT IN THE APP

11. A club's page shows its weekly matchup and its weeks record, and no
    games record, no "Plan a game", no "Clubs near you". Manage has no
    "Open to games". A captain can still plan a training session and
    members can still tap "I'm in". The website is unchanged.

CHAMPS OF THE WEEK

12. **The notification.** The Monday after your club wins a matchup,
    between 5 PM and 9 PM New York, every player who was counted in that
    matchup gets one notification: "<CLUB NAME> IS STRIVE CHAMPS OF THE
    WEEK" with "You beat <other club> by N minutes per player." Once. A
    club that lost or drew gets nothing.
13. **The tap.** Tapping it opens that club's page.
14. **The mark.** That club's card on the Clubs tab and its page show
    "Strive champs of the week" in gold for that week, and it is gone the
    week after unless they win again.
15. **Switched off.** With Clubs switched off under Settings,
    Notifications, the champs notification does not arrive.

THE CLOCK IS STILL RUNNING

16. **It arrives.** With notifications on, start a clock and leave it: at
    1 hour 30 minutes the phone shows "Your clock is still running" / "1h
    30m so far. Your finish photo stops it." Once, even with no signal
    (airplane mode) and with the app swiped away.
17. **The tap.** Tapping it opens the clock, ready for the finish photo.
18. **Taken back.** Start a clock, then take the finish photo (or "Stop
    without posting") before 1h 30m: nothing arrives later. To check
    without waiting, the wait is one number (CLOCK_NUDGE_MINUTES in
    lib/elite/training-clock.ts) I can shorten in a test build.
19. **Never asked for.** On a phone where notifications were never turned
    on, starting a clock raises no permission question and nothing
    arrives.

## Email confirmation, on a phone only (Nov 26 2026, migration 093)

Only shows once RESEND_API_KEY is set in Vercel and migration 093 is
applied; until then nobody is asked. Make a new free account with an email
you can open on the same phone.

1. Right after "Create my account" the app opens on "Check your email" with
   the address you typed, before the @username and the photo.
2. The code arrives in Mail ("Your Strive Elite code"), and the box offers
   it above the number pad (iOS fills a code from Mail). Tap it: the box
   holds 6 digits.
3. The number pad comes up by itself and Confirm stays above it.
4. Type a wrong code and tap Confirm: "That code does not match. Check the
   email and try again." and the box empties.
5. Tap Send a new code: "Sent. Check your email." and the line under it
   counts down to the next one. A second tap inside the minute says how long
   to wait. The new email's code works, the old one does not.
6. Wrong email? Change it: one email box, Send the code. The code goes to
   the new address and the screen says it.
7. Airplane mode: Confirm says it could not reach Strive; back online it
   works on the next tap.
8. The right code moves you straight on to the @username. Close the app and
   open it again: it does not ask for the code again.
9. Delete my account and Sign out on the screen both work.

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

## The update screen, a broken screen, and an invite on an iPhone (Nov 26 2026, from build 10)

- [ ] Settings shows the right build number at the bottom ("Strive Elite 1.0.0 (10)"). The update screen reads the same number.
- [ ] On /coach/free set "Oldest build that still works" one above the build on the phone. Close the app fully and reopen it: one screen, "A new Strive Elite is ready", and "Get the new version" opens TestFlight. Set it back to 0: the next open goes straight in.
- [ ] With airplane mode on, the app opens as usual (the check never blocks without an answer).
- [ ] Paste the TestFlight public link on /coach/free. On an iPhone that is signed out of the website, open an invite link from a text: the page shows the code and "Get the app"; "No iPhone? Join on the web" opens the form with the invite still on it.
- [ ] After any crash or "That screen did not load" page, the App errors card on /coach shows a line that starts /iphone/ with the build number and the screen.

## The Monday moment, on a phone (Nov 26 2026)

- [ ] A free account that trained timed sessions last week opens Week on Monday: one card at the top, "Last week you trained ...". Gym shows as its own line only when gym was logged. With two or more friends who trained, a place line shows only when it is in the top half. "Your best week yet." with the small gold star only after three earlier weeks of training.
- [ ] Tap "Got it": the card is gone. Close the app fully and reopen Week: still gone. Next Monday a new card shows once.
- [ ] A week with no timed training (or only typed time) shows no card at all. No notification arrives for any of this.

## The App Store rating ask, on a phone (Nov 26 2026)

- [ ] This can only be seen in an App Store build. In TestFlight Apple never shows its rating sheet, and the example build never asks.
- [ ] In an App Store build on a phone where the app first opened 7 or more days ago: reach the week's target on Week (free), or finish and close the last session of a member's week, or put away a Monday card that says "Your best week yet." Apple's own rating sheet may appear once (Apple decides whether it shows). There is no screen or button of ours for it.
- [ ] It never appears during a session or while a training clock is running, and never a second time in the same version.

## Adding a friend in person, on two phones only (Nov 26 2026)

Add a friend by exact @username, My code (a QR code), and an invite link
that opens the app (`lib/elite/friend-add.ts`, `lib/elite/friend-link.ts`).
The simulator pictures the three screens with example data
(`sim/shots.sh` 60 to 62, `sim/flows/17-add-a-friend.yaml`). What it
cannot show is below: the QR code being read, and a link opening the app.

**A link opening the app works only in a signed build with the new
entitlement** (`applinks:thestriveapp.com` in `mobile/app.json`), made
AFTER the site's half is live (`/.well-known/apple-app-site-association`
on main). Never in the simulator's example build, and not in a build made
before this. The iPhone reads the site's file when the app is installed
(through Apple's own servers, which can lag by hours): if a link still
opens the website right after installing, delete the app, install it again
and try once more before calling it broken.

Two phones, each signed in to its own free account (A and B), neither a
friend of the other.

1. **By @username.** On A: Friends, scroll to the bottom, "Add a friend".
   Type B's @username with the @ and in capitals: "Request sent. You and
   <B> are friends once <B> accepts." The button stays above the keyboard
   the whole time. The request arrives on the other phone: B's Friends
   shows it, Accept, and both see each other.
2. **The refusals.** On A type a username nobody has: "We could not find
   that @username. Check the spelling." Type A's own: "That is your own
   @username." Type B's again once you are friends: "You are already
   friends." Tap the button with the box empty: "Type their @username
   first."
3. **A block reads as not found.** On B block A. On A type B's @username:
   the same "We could not find that @username" line as for a name nobody
   has. Unblock afterwards.
4. **My code.** On A: "Add a friend", "Show my QR code" (and You, "My QR code").
   A white card with the QR code, A's name, @username and "My code:
   XXXXXXXX" under it. Turn the phone's brightness down: the code is still
   black on white.
5. **Scan my QR with another iPhone's Camera.** On B open the iPhone's own
   Camera and point it at A's code: a yellow tag appears under the code.
   Tap it: the app opens (not Safari) on one screen, "<A's first
   name> invited you", with A's initials and no photo, and "Send <A> a
   friend request". Nothing has been sent yet: A's Friends shows no
   request until B taps the button. Tap it: the request arrives on the
   other phone (A's Friends).
6. **Not now.** Scan again on B and tap "Not now": the screen closes to
   where B was, and A gets nothing.
7. **A link in Messages opens the app.** A taps "Send my link" and texts
   it to B. On B tap the link in Messages: the app opens on the same
   "invited you" screen. Do it once with the app already open on another
   screen (the invite comes up on top, and the back gesture returns to that
   screen) and once with the app fully closed (it opens on Friends, then
   the invite comes up on top).
8. **A club's link.** The same with a club's invite ("Invite a teammate"
   on the club page): the screen shows the club's crest and name and "Ask
   to join <club>"; the captain gets the request under Manage.
9. **A new player keeps the code.** Sign B out. Tap A's link in Messages:
   the app opens on sign-in, nothing else. Join free with a new email:
   after the username and the photo, the code question has A's code
   already typed. "Use my code" sends the request; "I do not have a code"
   goes on with nothing sent.
10. **With the app not installed** the link opens the website page:
    delete the app from B, tap A's link: Safari opens
    thestriveapp.com/join with A's first name and the code, as before.
11. **Other links stay out of the way.** With the app installed, tap a
    link to thestriveapp.com/join with no code (or with ?w=): the app
    opens where it was, or on its first screen, and nothing is asked.
    Links to any other page of the site (/5v5, /pro, /terms) still open
    Safari.
12. **Saved passwords still work** on the sign-in screen (the same
    entitlement list carries both).
