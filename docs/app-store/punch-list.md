# Strive Elite for the App Store: the punch list

Started Nov 18 2026 on Coach Yinka's word: "keep track of everything
you'll need to do to have this be the best first draft possible for the
App Store. Mirror the best simplistic, effective, dopaminergic, clean,
non-spammy apps ... without any holes."

This is the working list. `README.md` beside it is the rule-by-rule
checklist; this file is what is left to do, who does it, and in what
order. Every item has an ID so nothing gets lost while other work is
going on. Status words: TODO, DOING, DONE (with the date), BLOCKED (and
on what), HIS (Coach Yinka's decision or account).

## The standard

What the best training apps have in common, and what each one means
here:

1. One screen, one job. Home answers "what do I do today" and nothing
   else competes with the Start button.
2. It feels like the phone, not a website: nothing smaller than 11 pt,
   every button at least 44 pt, no zoom, no bounce, no blue tap flash,
   fresh the moment it is reopened, signed in for good.
3. The reward is the work itself: a clear finish, a number that only
   goes up, a tap of vibration. No streaks, no points, no guilt.
4. It asks for a permission once, at the moment the member can see why.
5. It only speaks when there is something worth saying: a new week, a
   message from the coach, a Film Room.
6. Nothing is ever empty, broken or slow without saying why.

## Found in the Nov 18 walk of every member screen (phone size)

Measured on a local build at 390 x 844, example player:

| Screen | Height | What is wrong |
|---|---|---|
| Home | 2,094 px | Still two and a half screens. Time trained shown twice, the week shown twice, Extra Work, a stats strip, the coach's note and Achievements all sit under the Start button. |
| Training | 1,291 px | Good. |
| Film | 2,519 px | Long; the Film Room card and the old breakdown stack. Needs a look with a real member's data. |
| Progress | 1,848 px | Acceptable for a page a member opens on purpose. |
| Coach | 1 screen | Good. Message box is 42 px tall (2 short). |
| Account | 1,112 px | Good. No way to change a password without signing out. |
| Sign in | 1 screen | A link out to strivesoccer100x.com, and the example tour offered twice. |
| Session | 1 screen | Good. "How to do it" is a 20 px target. |
| Finish | 1 screen | Good. |

Across the member side: 127 uses of 9 px and 10 px type in 49 files
(Apple's floor is 11 pt); the notification bell is a 36 px target; no
poster image on any drill video, so a slow connection shows a black box.

## A. Mine, no account needed (the app itself)

| ID | Item | Status |
|---|---|---|
| A1 | Home is one screen: the session card, then one quiet row. Time trained once, the week once. Achievements move to Progress. Extra Work and the coach's note stay but fold. | TODO |
| A2 | Type floor: nothing under 11 px on any member screen; secondary text 13 px or more. A test holds the floor. | TODO |
| A3 | Tap targets: every button, link and control on a member screen is at least 44 x 44 (bell, message box, send, "How to do it", session progress marks, support links). | TODO |
| A4 | Phone feel: no page bounce, no text selection or long-press menu on buttons and pictures, no zoom on a field. | TODO |
| A5 | Fresh on reopen: when the app comes back from the background after a minute or more, the screen refreshes itself. | TODO |
| A6 | Drill video posters: every clip on our own domain shows its first frame at once; the next drill's clip loads ahead. (Manus-hosted clips get theirs when they move, see D7.) | TODO |
| A7 | Badges match the rule "a break never costs": "3 Perfect Weeks, three straight weeks at 100%" becomes three full weeks, any three; the example player's "7-Day Streak" goes. A badge already earned is never taken away. | TODO |
| A8 | Notifications are asked for once, on the finish screen of the first completed session, with the reason. The card no longer sits at the top of every page. The Account switch stays. | TODO |
| A9 | Change password inside Account (current password, new password). | TODO |
| A10 | Sign-in inside the iPhone app: no link to another website, the example tour offered once. The website's sign-in is unchanged. | TODO |
| A11 | First run, start to finish at phone size: sign in, the agreement, the five onboarding steps, the first dashboard. Same floors as A2 and A3. | TODO |
| A12 | Every state that is not the happy path, at phone size: no week built yet, membership paused, on a break, week finished, no Film Room announced, no messages, offline, the error page. Each says what is happening and what happens next. | TODO |
| A13 | The bell: the red count clears when the list is opened; old notes do not pile up. | TODO |
| A14 | Film page with a real member's shape of data: one Film Room card, short. | TODO |
| A15 | Screen readers and contrast: every icon-only button has a name; grey text passes contrast on black. | TODO |
| A16 | App icon at 1024 px from a sharp source, and the launch screen matched to the first frame of the app so there is no flash. | BLOCKED on D6 (the logo file) |
| A17 | New App Store screenshots once A1 to A10 land (the five in `screenshots/` were taken before this pass). | TODO, after A1-A10 |

## B. Research to settle before the first build

Each of these was marked UNCONFIRMED or NOT PROVEN in `README.md`. The
answers go back into that file with their sources.

| ID | Question | Status |
|---|---|---|
| B1 | A shell that loads the live site (`server.url`): how Apple reviews these today under 4.2, and what the approved ones have in common. | TODO |
| B2 | Staying signed in: do the sign-in cookies survive closing and reopening the app in the iPhone web view, and for how long. | TODO |
| B3 | Keeping the screen awake during a session inside the iPhone web view, or the plugin that does it. | TODO |
| B4 | Camera and photo library from a file field in the web view (Send a clip, Film Room, progress video). | TODO |
| B5 | Links that leave the app: Zoom's Join link, the Dribbling Transformation site on the web, mailto. Which open where. | TODO |
| B6 | Saved passwords and Face ID fill on the sign-in screen (associated domains, `webcredentials`). | TODO |
| B7 | The app-level privacy manifest: required or not for this shell, and its contents. | TODO |
| B8 | Apple's Declared Age Range API and the state age laws: what a small app with 12 to 15 year old members must do at submission. | TODO |
| B9 | Guideline 3.1.1 and 3.1.3(d) for coaching apps: recent approvals and rejections, and the wording that worked in review notes. | TODO |
| B10 | What a person who downloads the app without a membership should see, so Apple does not call it an app for nobody: the example tour, and whether a "request a call" link is allowed. | TODO, then HIS to decide |

## C. Blocked on the Apple Developer account (unpaid as of Nov 18)

| ID | Item |
|---|---|
| C1 | First compile and TestFlight upload; fix what it flags. Nothing in `native/` has ever been built. |
| C2 | Native push end to end on a real iPhone (the three `APNS_` values in Vercel). |
| C3 | Universal links, so a texted link opens the app (needs the Team ID). |
| C4 | Prove B2 to B6 on a real phone, not on paper. |
| C5 | The privacy answers, age rating, categories and review notes entered in App Store Connect from `listing.md`. |
| C6 | TestFlight with the current members before public review. |

## D. Coach Yinka's

| ID | Item |
|---|---|
| D1 | Pay the $99; send the Team ID and individual or organization. |
| D2 | The seven values into Vercel and GitHub secrets (named in `README.md` section 6). |
| D3 | One player login and one coach login for Apple's reviewer, with a live week in it. |
| D4 | How the app is described to Apple (1:1 coaching, nothing sold inside), and the answer to B10. |
| D5 | The retention number, and a lawyer's read of the Privacy Policy and Terms. |
| D6 | A sharp logo file for the app icon (1024 px or a vector). |
| D7 | The word on moving the Manus-hosted drill videos to our own storage (it changes each drill's video link). |
| D8 | Approve the listing draft and the screenshots. |
| D9 | Test Forgot your password on his phone; turn notifications on from his iPhone so the test notification can be sent. |
| D10 | The heads-up text to families about the agreement screen. |

## Order

A1 to A15 and B1 to B10 run now. A17 follows A. C starts the day the
account is active. D items are asked for one at a time as each becomes
the thing in the way.

## Log

- Nov 18 2026: list opened from the walk of every member screen.
