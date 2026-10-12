# Manus brief: form confirmation page (after the Strive intake form)

Paste everything below the line into Manus. Replace BOOK_CALL_URL with
the real booking link before publishing. Everything else is final copy.

---

Build a single mobile-first confirmation page. A parent lands here right
after submitting the Strive intake form. The page has one job: get them
to book the call. Secondary job: show them what Strive is while they
wait. Keep it short. Nothing on this page sells harder than the call.

## About Strive (use for tone and facts, do not add to it)

Strive Soccer is a youth soccer training program in Northern Virginia,
run by Coach Yinka and Coach Gary. Two ways to train with us:

- In person: 1-on-1 sessions, duo sessions, and Friday group sessions
  for middle school and high school players. Field work with the
  coaches, built around the individual player.
- Strive Elite: our at-home program. Every Monday the player gets a new
  week in the app, four sessions of about 40 minutes, a video for every
  drill, progress tracking, and a weekly text to the parent. Built by
  Coach Yinka and Coach Gary around what that player specifically needs
  to reach the next level. $350 a month, month to month. Anyone who
  joins by Nov 1 locks in $249 a month for life. Same-day refund if it's
  not for them.

The call decides which fits. Many players do both.

## Page structure and exact copy (top to bottom)

### Header
Wordmark: logo coin (https://thestriveapp.com/strive-logo-512.png, 44px,
round) next to "STRIVE SOCCER" in Barlow Condensed 900, white.

### Headline (Barlow Condensed 800, about 34px on phones)
You're in. One more step.

### Sub-headline (Barlow 15px, white 55%)
We read every form ourselves. Book your call below and we'll go through
your player's situation together and map out the right next step, in
person, at home, or both.

### Primary button (gold #c8a858 fill, black text, full width on phones)
Book your call
Link: BOOK_CALL_URL
Under the button, small white 45% text: 15 minutes. Wednesday and
Thursday evenings, Saturday evenings, Sunday afternoons.

### Video slot
Leave a full-width 16:9 placeholder with a dark fill and the text
"Video coming soon" centered, 12px, white 35%. I will send a second
video for this slot later. Do not embed anything there now.

### Section label: WHAT HAPPENS ON THE CALL
Three short lines, one column, no numbers:
- Where your player is right now and what's getting in the way.
- What they're working toward this season and beyond.
- Which path fits: in-person sessions, Strive Elite at home, or both.

### Section label: TWO WAYS TO TRAIN
Two cards, side by side on tablet and up, stacked on phones:

1. **In person**
   1-on-1s, duos, and Friday groups in Northern Virginia. Field work
   with Coach Yinka and Coach Gary, built around your player.
2. **Strive Elite, at home**
   A new week every Monday in the app. Four sessions, a video for every
   drill, and a text to you every week. Built by both of us around what
   your player specifically needs. $350 a month. Join by Nov 1 and lock
   in $249 a month for life.

### Second button (outlined, white border)
Book your call
Link: BOOK_CALL_URL

### Footer
Tiny: "Questions before the call? DM @strivesoccerfc on Instagram."
Then Privacy (https://thestriveapp.com/privacy) and Terms
(https://thestriveapp.com/terms). Nothing else.

## Look and feel (match the landing page exactly)
- Background #0d0d0d, text white, secondary text white at 55%, card
  borders white at 8%, card fill white at 2%, rounded corners 16 to 20px.
- Gold #c8a858 only on the primary button and one short rule under the
  headline. Never gold body text, no gradients, no bright yellow.
- Fonts from Google Fonts: Barlow Condensed 800/900 for headlines,
  uppercase; Barlow 500/600 for everything else. Small labels uppercase
  with 0.2em letter-spacing.
- Calm, dark, premium. No stock photos, no emojis, no exclamation points,
  no countdown, no popup, no chat widget.

## Technical
- Mobile first, test at 390px, no horizontal scroll.
- Page title: "You're in | Strive Soccer".
- Meta Pixel slot in the head with a placeholder PIXEL_ID, firing
  PageView on load and Lead once on this page (this page only loads
  after a real form submit, so PageView here is the lead event).
- When BOOK_CALL_URL opens a booking widget, open it in the same tab.

## Hard rules
- Never use the words "AI", "automated", "algorithm", or "generated".
- No em dashes anywhere. Periods, commas, or colons.
- Say "your player", never "your child" or "your kid".
- It is "we" and "both of us", Coach Yinka and Coach Gary. Never "built
  by Coach Yinka" alone.
- No testimonials, player names, school or academy names, logos, star
  ratings, or any proof not in this brief. Do not label anything "real".
- No numbers other than the ones written here.
- Keep the copy exactly as written. If layout forces a change, ask first.
