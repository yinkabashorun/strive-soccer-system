# App Store listing: draft for Coach Yinka

Everything App Store Connect asks for when the app record is created, ready
to paste. DRAFT: nothing here is submitted until he approves it.

REWRITTEN Nov 25 2026 for the native iPhone app (`mobile/`), which is the
app that goes to review. The first draft described the earlier shell (the
website inside an app) and said three things that are no longer true of
the app a reviewer opens: that it has a coach side, that it has an example
tour on the sign-in screen, and that nothing in it has a price. The native
app is for players only, has no example tour, and offers Strive Pro after
the free quiz (the price is on that one screen, and Start Strive Pro opens
a web checkout). THAT LAST ONE IS THE DECISION THAT DECIDES REVIEW, and it
is his: see "The payment decision" below. No price goes in the name, the
subtitle or the screenshots either way.

## The fields

| Field | Limit | Draft |
|---|---|---|
| Name | 30 | Strive Soccer (the App Store Connect record; "Strive Elite" was taken). The name under the icon on the phone stays Strive Elite. |
| Subtitle | 30 | Personalized soccer training |
| Primary category | | Sports |
| Secondary category | | Health & Fitness |
| Keywords | 100 | soccer,training,drills,football,youth,coach,ball mastery,first touch,weak foot,speed,club,academy |
| Support URL | | https://thestriveapp.com/support |
| Privacy Policy URL | | https://thestriveapp.com/privacy |
| Marketing URL | optional | leave empty |
| Copyright | | 2026, then the legal name on the Apple account (HIS) |
| Price | | Free to download. Strive Pro is a subscription started on the website (see "The payment decision") |
| Availability | | United States only (his call, Nov 25 2026) |

Promotional text (170):

> Train on your own, with your friends watching. Post your training, see theirs, and get a week built around your game. Every drill on video.

Description:

> Strive Elite is where soccer players train on their own, together.
>
> POST YOUR TRAINING
> Take a photo when you start and a photo when you finish. The time between your two photos is your training. Your friends' training opens when you post yours. Give props. Friends are added by request only.
>
> YOUR WEEK, YOUR TARGET
> Set how much you want to train each week and watch the ring close. See how your week stacks up against your friends.
>
> CLUBS
> Start a club with your team or your pickup crew. Every week your club is matched with another club: the club that trains more per player wins the week. Plan a training session with your club.
>
> STRIVE PRO: A WEEK BUILT AROUND YOU
> Take the quiz and get a new week of sessions every Monday, built around what you need to work on. One drill at a time, each with its video, and a timer that counts your sets and your rest.
>
> COURSES
> A library of drills and guides to work through after your sessions: first touch, dribbling, weak foot, strength, speed and more.
>
> SEE THE WORK ADD UP
> Every session adds to your time trained and earns medals. Share your week to your story.
>
> For players 13 and older. Members of Strive Soccer's coaching program sign in with the account they made with their coach.

Every line above is something the native app does today. Not in it on
purpose: prices, the guarantee, results claims, alumni names, courses that
are not in the app (Passing, Scoring Goals), and the things that are on the
website only (the coach chat, Film Room, the monthly call, My Drills).
Free sign-up must be switched on at /coach/free for review.

## Screenshots (6.9-inch iPhone, 1320 x 2868)

Made by the simulator run from the real app with example data (one made-up
player, "Marcus B."; every picture in them is a still of our own drill
clips): the `store/` folder on the `app-screens` branch, eight PNGs at
1320 x 2868. Suggested order: Train (home), a drill in the session, Week,
Friends, a club, a player's profile, the friends board, Courses. HIS to
check: who appears in the drill stills, and whether he wants a headline
over each one (plain screenshots are allowed). The five older pictures in
`docs/app-store/screenshots/` are of the website and are not used.

## Age rating questionnaire

Answer None to violence, gambling, mature themes and the rest. Say Yes to
user-generated content: players share photos of their training, a one-line
note, a club name and a Playing for line with the friends they accepted
and their club mates. Describe it as: friends by accepted request only, no
public feed and no search, a word filter on every typed line, report on
every post, profile photo, Playing for line and club, block on any friend
or club mate, a coach queue that is texted on every report and acts within
24 hours, and Terms with zero tolerance for objectionable content. The app
is 13 and older, so expect 12+ or 13+, not 4+.

"Messaging and Chat": the native app has no messages between people (no
direct messages, no chat between clubs; the coach chat is on the website
only). Answer No, and change it to Yes in the same update that ever adds
the coach chat or any message between players: apps have been rejected
under guideline 2.3.6 for a wrong answer here (`research-2026-11-18.md`,
B8). Unrestricted web access: No. Never choose the Kids Category.

## App privacy answers

Data linked to the user, none used for tracking: name, email address,
phone number; photos or videos; other user content; user ID; device ID
(the push token); product interaction; purchases (whether Strive Pro is
on). Crash data only if a crash reporter is ever added (none is today). The free
app adds nothing new to the list: its posts are photos and other user
content, its birth month and year sit under other user content (used only
for the 13-and-older check). Tracking: No.

## The payment decision (DECIDED Nov 25 2026, his "Keep it": United States only, the web checkout stays)

After the free quiz the app shows one offer screen for Strive Pro with its
monthly price, and "Start Strive Pro" opens a web checkout (Stripe) in a
sheet inside the app. From memory of Apple's rules, to verify against the
current guideline 3.1.1 before submitting: a subscription to digital
content normally has to be sold through Apple's in-app purchase; since
2025 an app on the UNITED STATES storefront may link out to a web
purchase. Three ways to go:

1. Keep it as built and list the app on the US storefront only. Fastest.
   The checkout should then open in Safari rather than a sheet inside the
   app (one line), which is the form Apple's US rule describes.
2. Take the offer and the price out of the iPhone app (a free player sees
   no way to pay in the app; they start Strive Pro on the website and the
   app picks it up). Safest for review, costs sign-ups.
3. Sell Strive Pro through Apple's in-app purchase. Apple keeps a share
   (15% for a small business, from memory); a few days of work.

My suggestion: 1, with the checkout opening in Safari, and 2 as the
fallback if review objects. Book Apple's "Meet with App Review" (D12) and
ask before submitting.

## Notes for the reviewer (paste into App Review Information)

Written for option 1 above. If he picks another, the second paragraph
changes.

> Strive Elite is a training app for soccer players 13 and older.
>
> Anyone can join free on the sign-in screen (Join free). A new player picks a username and a photo, then is asked once, "Have a code from a teammate or a club?". A code sends that teammate a friend request, or asks that club's captain to let the player in, and the player goes straight into the free app. With "I do not have a code" the player takes a short quiz about their game, then is shown Strive Pro once: a weekly training plan built from their answers, as a monthly subscription. "Start Strive Pro" opens our website's checkout. The app is offered on the United States storefront only. "Not now, start free" continues into the free app, which stays free. A player who came in with a code can take the same quiz later from the one card on the Week tab ("See what you get").
>
> The free app: a player times their own training between two photos taken in the app's camera ("Start training", then "Finish my training" at least one minute later) and posts it for the friends they accepted. The time between the two photos is what counts toward their weekly target, the friends board and their club. "Trained without the clock?" adds a length by hand, which shows on the player's own week only. A player can start or join a club. There is no public feed and no search: friends are added only by a request the other player accepts, and a club is joined by a code and its captain's approval. Every post, profile photo, Playing for line and club can be reported; any friend or club mate can be blocked (and unblocked under Settings > Blocked players); typed text passes a word filter; every report texts our coaches, who review it within 24 hours and remove the content and the account where needed. Our Terms have zero tolerance for objectionable content.
>
> Clubs: a captain can plan a club training session, seen only by that club's own members. Every session shows which club organized it; Strive does not run or supervise them, a captain accepts that before planning and a player before saying they are in. A place is the name of a public field or park: the app refuses street addresses, links and phone numbers. Clubs do not meet each other through the app: the weekly matchup compares training time only, there is no list of other clubs to browse, no messaging between clubs and no direct messages between players.
>
> Strive Pro: a new week of sessions every Monday, one drill at a time with its video and a set timer, a library of courses, and medals for time trained. Members of our coaching program (families who joined with a coach) sign in with the account they made on our website and see the same training screens.
>
> Logins for review:
> Strive Pro player: [email] / [password]
> Free player: [email] / [password] (or tap Join free and make one)
>
> Every account has a profile photo and a username, asked for once after sign-up. The photo is seen only by the friends the player accepted and our coaches; it can be reported, and a coach can remove it.
>
> Account deletion: You > Settings > Delete my account.
> Notifications: optional, asked once, each kind on or off under Settings.
> Camera: used only when the player takes their start photo and finish photo for a training post, or a profile photo. Photos: used only when the player chooses a profile photo. To see a friend's training from today, post your own first: Start training, take a photo, wait one minute, Finish my training, take a photo, Post to my friends.

The two logins are made on the day of submission. Each needs a profile
photo and a username already set, so the reviewer does not open on the
one-time photo and username screen. The Strive Pro login needs a live week
in it. A coach login is not given: a coach account opens on one screen
that says the coach side is on the website.

## The text to current families before the agreement screen appears

> Hey [Parent], quick heads up. The next time you open the Strive Elite app it will ask a parent to read and accept our updated terms. It takes a minute and it only asks once. Let's keep [First] rolling.
