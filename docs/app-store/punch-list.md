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
| A1 | Home is one screen: the session card, then one quiet row. Time trained once, the week once. Achievements move to Progress. Extra Work and the coach's note stay but fold. | DONE Nov 18. Home is 844 px, one screen: greeting, the session card, one quiet row (Extra work, Coach's note, Take a break). Achievements and the stats strip live on Progress. |
| A2 | Type floor: nothing under 11 px on any member screen; secondary text 13 px or more. A test holds the floor. | DONE Nov 18 (`tests/member-surface.test.ts`) |
| A3 | Tap targets: every button, link and control on a member screen is at least 44 x 44 (bell, message box, send, "How to do it", session progress marks, support links). | DONE Nov 18 (`tests/tap-targets.test.ts`). Session progress marks are about 40 px wide when a session has six or more drills. |
| A4 | Phone feel: no page bounce, no text selection or long-press menu on buttons and pictures, no zoom on a field. | DONE Nov 18 (`tests/phone-feel.test.ts`). Not yet felt on a real iPhone (C8). |
| A5 | Fresh on reopen: when the app comes back from the background after a minute or more, the screen refreshes itself. | DONE Nov 18. Held while the session player is open; that an in-progress upload also holds it was not re-confirmed. |
| A6 | Drill video posters: every clip on our own domain shows its first frame at once; the next drill's clip loads ahead. (Manus-hosted clips get theirs when they move, see D7.) | DONE for the 59 clips on our own domain (posters, next clip fetched ahead). Manus-hosted clips get theirs when they move (D7). |
| A7 | Badges match the rule "a break never costs": "3 Perfect Weeks, three straight weeks at 100%" becomes three full weeks, any three; the example player's "7-Day Streak" goes. A badge already earned is never taken away. | DONE Nov 18: "3 Full Weeks", any three; a stored "7-Day Streak" shows as "7 Days Trained"; no earned badge is lost. |
| A8 | Notifications are asked for once, on the finish screen of the first completed session, with the reason. The card no longer sits at the top of every page. The Account switch stays. | DONE Nov 18, as its own screen after Done on the first finished session, once per phone. Seen only with the browser permission stubbed. |
| A9 | Change password inside Account (current password, new password). | DONE Nov 18 at /account/password. Not tried against the live sign-in service. |
| A10 | Sign-in inside the iPhone app: no link to another website, the example tour offered once. The website's sign-in is unchanged. | DONE Nov 18. |
| A11 | First run, start to finish at phone size: sign in, the agreement, the five onboarding steps, the first dashboard. Same floors as A2 and A3. | DONE Nov 18. |
| A12 | Every state that is not the happy path, at phone size: no week built yet, membership paused, on a break, week finished, no Film Room announced, no messages, offline, the error page. Each says what is happening and what happens next. | DONE Nov 18. A new family whose membership is not on yet now reads "One step left", not "paused". |
| A13 | The bell: the red count clears when the list is opened; old notes do not pile up. | DONE Nov 18: opening it marks everything read; newest 12 shown. |
| A14 | Film page with a real member's shape of data: one Film Room card, short. | DONE for a member (one Film Room card and a folded games line). The example player still shows the old long film page. |
| A15 | Screen readers and contrast: every icon-only button has a name; grey text passes contrast on black. | DONE Nov 18 (`tests/named-controls.test.ts`, contrast in `tests/member-surface.test.ts`) |
| A16 | App icon at 1024 px from a sharp source, and the launch screen matched to the first frame of the app so there is no flash. | BLOCKED on D6 (the logo file) |
| A17 | New App Store screenshots once A1 to A10 land (the five in `screenshots/` were taken before this pass). | TODO, after A1-A10 |
| A18 | Sign-in on the server, so the session cookie is set by the server and the iPhone keeps it (a script-written cookie is capped at 7 days by WebKit, so a member who skips a week gets signed out). Same for the reset-password form. | DONE Nov 18 (`lib/elite/sign-in.ts`, `tests/sign-in.test.ts`). PROVEN Nov 19: Coach Yinka signed out and back in on his phone on the live app. New accounts and the reset form sign in on the server too; 20 tries per 10 minutes per caller |
| A19 | The session is refreshed on every member page: `/film`, `/courses`, `/messages`, `/onboarding` and `/` were missing from the middleware. | DONE Nov 18 (`tests/session-refresh.test.ts`) |
| A20 | Nothing bounces to Safari: Terms and Privacy links on the agreement and sign-up screens open in place inside the app; "your clip from two weeks ago", film links and course downloads play in the app. Zoom and mail links leave on purpose. | DONE Nov 18 for our own pages, clips, YouTube and Vimeo (`lib/elite/app-links.ts`, `AppLink.tsx`, `tests/app-links.test.ts`). LEFT: a Hudl, Veo or Drive film link still opens Safari; coach-side links are untouched |
| A21 | Quiet while the app is open: no banner, no sound; the Coach tab and the bell show what arrived. | DONE Nov 18 (`native/capacitor.config.ts`, test) |
| A22 | App-level privacy manifest in the app target (no tracking). | DONE Nov 18; the collected-data list is filled on the first build (C5) |
| A23 | Saved passwords offered on the sign-in screen: the email field marked as the user name; the association file on the site and the entitlement in the app. | Field: DONE Nov 18. File and entitlement: BLOCKED on the Team ID |
| A24 | The screen stays on during a session on every iPhone the app allows: raise the minimum to iOS 16.4 or add the keep-awake plugin. | DONE Nov 18: minimum is iOS 16.4, no plugin (never compiled) |
| A25 | A guard for guideline 2.5.19: a new member-facing feature stays hidden inside the app until a reviewed build describes it. One list, one test. | TODO |
| A26 | Uploads that survive real life: progress for each clip, the screen kept awake, and large Film Room clips sent in resumable pieces. One line on where to turn the camera back on if it was refused. | TODO |
| A27 | The public /demo page (it carries the Meta pixel) can never load inside the app. | DONE Nov 18: three guards (`tests/demo-never-in-app.test.ts`) |
| A28 | Launch screen is plain black matching the first screen, with no logo (Apple's launch guidance). Changes A16: the icon still needs the sharp logo, the launch screen does not. | DONE Nov 18 (never compiled) |
| A29 | Every push text re-read against Apple's rules: it informs, never orders, never sells; one per event. | DONE Nov 18 as an audit: every push text is in `lib/elite/push-texts.ts` under a test, wording unchanged. His to rule on: see the log |
| A30 | Stop nudging a member who has ignored several nudges in a row. | TODO, needs his word on the number |

## B. Research to settle before the first build

ALL TEN ANSWERED Nov 18 2026, with sources, in `research-2026-11-18.md`
(plus B11, ten behaviours of a calm app from Apple's design guidelines).
Not every source could be opened from this environment; each answer says
how sure it is. What each answer turned into:

| ID | Question | Answer in one line | Became |
|---|---|---|---|
| B1 | A shell that loads the live site | Allowed; judged on what the reviewer experiences. Two rules bite: nothing new without review (2.5.19), nothing that drops into Safari. | A20, A25, the review notes |
| B2 | Staying signed in | Server-set cookies last; script-written ones are capped at 7 days. Ours was script-written. | A18, A19, C4 |
| B3 | Screen awake | Works in the iPhone web view from iOS 16.4. | A24 |
| B4 | Camera and library | Works. Camera clips are medium quality; library videos are converted first; big uploads have no resume. | A26, C4 |
| B5 | Links that leave | Any new-window link opens Safari, even our own pages. Zoom opens Zoom. | A20, A27 |
| B6 | Saved passwords | Offered once the app and the site are associated; saving from the app needs a plugin (optional). | A23 |
| B7 | Privacy manifest | Not required for upload by this shell today; expected anyway. | A22 |
| B8 | Age laws and consent | Not a review gate. The age rating must say Yes to Messaging and Chat. A ticked box is not verifiable consent. | `listing.md`, C7, D13 |
| B9 | The payment rule | Reviewers object to what the demo login can open (courses, videos), not to buy buttons. No proven wording exists. | D4, D12 |
| B10 | No membership, no use | The example tour helps but never replaces demo logins. A second risk: "an app for one business" (3.2). Unlisted distribution is Apple's answer. | D11 |

## C. Blocked on the Apple Developer account (unpaid as of Nov 18)

| ID | Item |
|---|---|
| C1 | First compile and TestFlight upload; fix what it flags. Nothing in `native/` has ever been built. |
| C2 | Native push end to end on a real iPhone (the three `APNS_` values in Vercel). |
| C3 | Universal links, so a texted link opens the app (needs the Team ID). |
| C4 | Prove B2 to B6 on a real phone, not on paper. |
| C5 | The privacy answers, age rating, categories and review notes entered in App Store Connect from `listing.md`. |
| C6 | TestFlight with the current members before public review. |
| C7 | Apple's Declared Age Range call after sign-in, stored on the account (a small native plugin; build with the iOS 26.2 SDK or later). Needed before selling to families in Texas or Utah. |
| C8 | The seven checks at the end of `research-2026-11-18.md` run on the first build (signed in after a restart and with the clock moved 8 and 30 days; screen awake; a 100 MB clip; every link; saved passwords; the upload email; a push with the app open and closed). |

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
| D11 | How the app is listed: public on the US storefront only (found in search, carries the "app for one business" risk), or unlisted (each family gets the link from the coach, no search presence). My suggestion: public, US only, and switch to unlisted if Apple objects. |
| D12 | Book Apple's 30-minute "Meet with App Review" appointment once the account is active, and ask the payment question before submitting. |
| D13 | Parental consent for a member under 13: tie the parent's payment and the sales call to the consent record (what is shown before payment, a short script on the call). A lawyer's call. |
| D14 | The fallback order if Apple refuses on payment: appeal as 1:1 coaching; then take the course library out of the iPhone app; then Apple's in-app purchase. |

## Order

A1 to A15 landed Nov 18. A18, A20, A23 to A30 are next, in that order. A17 follows A. C starts the day the
account is active. D items are asked for one at a time as each becomes
the thing in the way.

## Log

- Nov 18 2026: list opened from the walk of every member screen.
- Nov 18 2026: research B1 to B11 back and saved. A19, A21, A22 done the
  same hour. A18 to A30, C7, C8 and D11 to D14 added from it.
- Nov 18 2026: A1 to A15 merged and live (11 commits, 399 tests). Checked
  in a desktop browser at phone size with the example player only;
  nothing has been felt on a real iPhone yet. Left for Coach Yinka to
  rule on: the example Film banner and the game schedule card still say
  Northern Virginia games and "Coach might pull up", though in-person is
  off the offer.
- Nov 18 2026: A18, A20, A23 (the field), A24, A27, A28, A29 merged and
  live (455 tests). Sign-in now runs on the server and could not be
  tested against the live service from here; nothing in `native/` has
  been compiled. From the push audit, not changed, his call: the Film
  Room and check-in pushes end on an instruction ("Upload 3 to 5 clips
  by ...", "Pick your 30-minute time ..."); a new week reads "just
  dropped" from one sender and "is live" from the other; a coach
  message shows its first 140 characters on a locked phone; "send
  again" on a check-in day sends a second push. Found outside the
  items: "Apply to join" on sign-up links to another site; the forgot
  password form, clip upload and the drill bank still use the
  browser's database client (none signs in; belongs with A26). Before
  a big sign-up day: every sign-in now reaches the sign-in service
  from our server's addresses, so its per-address limit is shared.
  Next: A25, A26, then A17.
- Nov 19 2026: A18 proven on the live app (Coach Yinka signed out and back in on his phone).
