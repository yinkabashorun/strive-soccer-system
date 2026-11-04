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
run by Coach Yinka and Coach Gary. As of Nov 4 2026 WE DO NOT OFFER IN
PERSON TRAINING. The only program is Strive Elite, our at-home program,
and this page must never mention in-person, field, 1-on-1, duo, group or
drop-in sessions. Strive Elite: a 90-day program for ECNL and MLS NEXT
players who want the next level. Every Monday the player gets a new week
in the app, a video for every drill, courses on top, Film Room every
week and a monthly call with us. Built by Coach Yinka and Coach Gary
around what that player specifically needs. $985 paid in full, or $400
a month, with a guarantee (see manus-offer-update.md).

The call is to see whether Strive Elite is the right fit.

## Page structure and exact copy (top to bottom)

### Header
Wordmark: logo coin (https://thestriveapp.com/strive-logo-512.png, 44px,
round) next to "STRIVE SOCCER" in Barlow Condensed 900, white.

### Headline (Barlow Condensed 800, about 34px on phones)
You're in. One more step.

### Sub-headline (Barlow 15px, white 55%)
We read every form ourselves. Book your call below and we'll go through
your player's situation together and map out the right next step.

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
- Whether Strive Elite is the right fit for them.

### Section label: STRIVE ELITE
One full-width card (no In person card, no second card):

**Strive Elite, at home**
The card copy in manus-offer-update.md, section B: the 90-day program,
$985 paid in full or $400 a month, and the guarantee.

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
