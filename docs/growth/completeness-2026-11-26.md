# What a finished app has: the gap list (Nov 26 2026)

Coach Yinka, Nov 26: "think about any other nuances deeply brainstorm. things
that we havent thought of that may be gaps in the product. do research on the
practical principles of the structure and completeness of the greatest
produced apps and recreate."

This sits beside `leaders-2026-11-24.md` (what makes players come back). That
file is about mechanics. This one is about completeness: the unglamorous
things a finished consumer app has in place before it goes public, checked
against this app as it is in the code today.

Each finding says where it came from: **primary** (the company's or Apple's
own page), **secondary** (press, a founder quoted by someone else),
**unverified** (standard practice, no source found), or **ours** (read from
this repo or the live database).

---

## 1. The one idea that decides the launch: density, not downloads

- A social app is worth nothing to a player whose friends are not in it.
  Poparazzi reached number one and shut down; its founders said "the value of
  the app is close to zero without that initial friend graph" (secondary,
  TechCrunch, May 2023).
- tbh and Gas launched one school at a time, so the first open was never empty
  (secondary). The book name for it is the "atomic network": the smallest
  group that keeps itself going (secondary, a16z, The Cold Start Problem).
- Facebook's "7 friends in 10 days" was found by looking at who stayed. The
  number is not sacred; each app has to find its own (secondary, Andrew Chen).
- A 790-person trial over 11 weeks found that seeing how you compare raised
  exercise more than encouragement did; support-only teams did no better than
  nothing (primary, PMC5008041). The friends board and the club matchup are
  the better-supported design. Keep them up front.

**What it means here.** The 32 tournament teams are 32 atomic networks. Judge
the launch per club, not per install. A club counts as activated with 5
players in it and 3 who have posted a timed training. That is our first
guess at "our 7 friends"; the Launch numbers card on /coach/free counts it so
the real number can be found.

---

## 2. Found in our own code, and fixed today

| Gap | Why it mattered | What was done |
|---|---|---|
| A member who did not come through "Join free" had no social side | The owner's own Strive Pro account opened on four member tabs with no Friends, Clubs or board | Every member 13 or older, on any membership, gets the whole app (`getsFreeApp`). Live. |
| Sign-up was held to 10 tries per 10 minutes per network address | At a tournament every phone is on the venue's one Wi-Fi. The eleventh player to join would have read "Too many attempts" | 150 per 10 minutes per address, in the app and on the site. `tests/launch-day-limits.test.ts` |
| Every app call was limited per network address | Forty teammates opening the app on one Wi-Fi shared one allowance | A signed-in caller is counted as themselves; the address keeps a ceiling 30 times higher |
| No "this build is too old" screen | The server changes daily. With hundreds of players on different builds, an old build shows buttons that answer nothing, and there was no way to move anyone | One number the coaches set; a build under it shows one screen and one button. Fails open. From build 10. |
| An invite link opened the website sign-up | Training is timed only in the app, so a teammate who tapped an invite on an iPhone could make a web account whose time counts on no board | Once the app link is saved, an invite opened on an iPhone shows the code and "Get the app". The web form is one tap away. |
| The app reported no errors | A screen that broke on a player's phone was invisible unless they said so. It also showed the framework's stock error page | The app's own "That screen did not load" page, and the error goes to the App errors card on /coach with the build and the screen |
| Nothing counted the free app's funnel | No way to tell whether a team that joined ever posted | Launch numbers card on /coach/free: joined, set up, in a club, 3 friends, first timed post, inside 48 hours, came back, and each club |

---

## 3. Gaps that need Coach Yinka's word (ranked)

### Before the public link goes out

1. **Supabase is on the free plan.** (ours) No backups, and a storage and
   bandwidth allowance that a photo app outgrows fast: every timed post is two
   photos. The plan's exact limits are his to read on the billing page; the
   Pro plan is the fix and was already owed for backups. This is the one item
   that can take the app down in its first busy week.
2. **Supabase's own sign-in limit is per network address** (Authentication,
   Rate Limits). Ours is fixed; theirs is a dashboard number. Raise it before
   an event where a whole team signs in on one Wi-Fi.
3. **Who lets players into the 32 team clubs?** A club the coaches make has no
   captain, so every request to join waits on a coach's tap at /coach/free.
   With about 288 players in one week that is a queue. Three ways: (a) the
   coaches make each club and tap "Let everyone in" in batches; (b) each
   captain starts their own club in the app and sends its code, so the captain
   approves; (c) build "make this player the captain" so a coach-made club can
   be handed over. Recommended: (b) for the launch, (c) built next. There is
   no way to hand over a captaincy today, and a club whose captain deletes
   their account is left with none.
4. **A paying member is offered a prize they cannot use.** The squad card says
   "Bring 3 teammates. Get a month of Strive Pro." to a player already paying
   by card, and Start my month then refuses. Either their next month is free
   (a Stripe credit) or the card reads differently for them.
5. **Moving the coaching families into the app** (his decision today). The
   code is ready for them (they have the whole app now). What is not decided:
   what they pay and how the old charge stops (Stripe is his side); that
   coach chat, Send a clip, Film Room, the monthly call, the progress video
   and the 3-month program do not exist on Strive Pro; and the one member
   under 13, who keeps Train and Courses only.
6. **Photos are not checked by anything but a report.** Timed posts are
   camera-only, which removes most of the risk; a profile photo comes from the
   library. Apple's rule 1.2 asks for "a method for filtering objectionable
   material" (primary). Text has the word filter; photos have report, block
   and the coach queue. Name who answers a report inside a day.

### Makes the loop stickier (each is a build, none is started)

7. **Add a friend in person.** No QR, no add by @username: today it is a link
   or a typed code. Safe minimum the leaders use for teens: exact @username or
   a QR, every add still accepted by the other player, never contacts, never
   location (Snapchat and Instagram teen defaults, primary and secondary).
   Clubs already make teammates friends, which covers the tournament.
8. **The running clock on the Lock Screen** (a Live Activity). Apple allows up
   to eight hours active (primary). It is the most "real app" thing a timer
   app can have, and it cuts forgotten clocks. It needs native code that
   cannot be tried without a phone, so it is a build-11 item, not a launch one.
9. **A personal Monday moment in the app, no new notification:** "Last week:
   3h 10m. 2nd of 7 friends." once, on the first open of the week, and a
   quiet "your best week yet" when it is. Members have the first half on
   their week's arrival; free players have neither.
10. **A see-through "my week" sticker for Instagram Stories** carrying the
    join link, the way Strava does it (primary). The plain picture exists; the
    sticker needs a Meta app ID from him.
11. **Ask for an App Store rating** after a finished week or a club win,
    never mid-training. Apple shows the prompt three times a year at most
    (primary). Only after the App Store release; TestFlight cannot rate.
12. **A page for parents.** What the app is, who can see what, how to report,
    how to delete. Teen apps without a safety story get one written for them
    (the Gas trafficking hoax, secondary). One page, linked from the listing.

### Structural, later

13. **No Android app.** An Android player has the website, which has no clock,
    so their time counts on no board. The same code can build for Android;
    it needs a Google Play account and its own push set-up.
14. **Sign-up asks for five typed things** (name, email, phone, password,
    birthday). Strava's own growth team called cutting friction to the first
    upload "one of the biggest wins" (secondary). The phone number is the
    field to question: needed for texts, or optional?
15. **An email is never confirmed**, so a mistyped one cannot reset its
    password.
16. **Texas's app-store age law** took effect June 2026 and Apple offers a
    Declared Age Range API for it (primary, Apple; court status since then
    unverified). For the lawyer's list.
17. **Apple and the web checkout.** The guideline text allows a link to an
    outside purchase on the US storefront (primary, read today), but does not
    say an app may skip Apple's own purchase altogether; whether a link-only
    subscription passes review is unverified. The stated fallback stands: the
    offer comes out of the iPhone app.
18. **TestFlight builds stop working after 90 days** (primary). Put a new
    build on the calendar before then. The public link holds up to 10,000
    testers and its first build is reviewed.

---

## 4. What we already have that amateur apps miss

Checked in the code, so it is not rebuilt by accident: account deletion in
the app; report, block, unblock and a coach queue; a word filter; the
agreement recorded with its version; offline ticks and an offline clock that
send themselves; skeletons, empty states and pull to refresh on every list;
a notifications ask at a moment that explains it, a switch per topic and
quiet hours; one upgrade prompt; saved passwords; a share card; the phone
checks written down; a simulator run that pictures every screen.

---

## 5. The numbers to watch in week one

Benchmarks for a social app (primary, a16z): day 1 / day 7 / day 30 of 50 / 35
/ 20 percent is OK, 60 / 40 / 25 good, 70 / 50 / 30 great.

Ours, on the Launch numbers card: joined; photo and username set; in a club;
3 friends or more; posted a timed training; posted inside 48 hours; came back
within a week; typical time to a first post; and per club, players, trained
this week, and activated or not.

---

## Sources

- Andrew Chen on "7 friends in 10 days": andrewchen.com
- Poparazzi shutdown: techcrunch.com, May 1 2023
- The Cold Start Problem: a16z.com/books/the-cold-start-problem
- Social app benchmarks: a16z.com/do-you-have-lightning-in-a-bottle-how-to-benchmark-your-social-app
- Comparison versus support trial: pmc.ncbi.nlm.nih.gov/articles/PMC5008041
- App Store Review Guidelines 1.2, 3.1.1, 3.1.3, 4.5.4, 5.1.4: developer.apple.com/app-store/review/guidelines
- Account deletion: developer.apple.com/support/offering-account-deletion-in-your-app
- Ratings prompt: developer.apple.com/app-store/ratings-and-reviews
- Live Activities: developer.apple.com/documentation/activitykit
- TestFlight limits: developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview
- Snapchat teen defaults: values.snap.com/privacy/teens
- Strava story sticker: support.strava.com (article 17718841)
- Strava growth team on first upload: revenuecat.com/blog/growth
- Texas age law and the Declared Age Range API: developer.apple.com/news/?id=2ezb6jhj

Not reachable from this session, so not used: Lenny's Newsletter, and Nikita
Bier's own writing (press summaries only).
