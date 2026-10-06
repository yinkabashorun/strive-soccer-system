# Manus brief: Strive Elite landing page (VSL funnel)

Paste everything below the line into Manus as one prompt, and upload the
VSL file with it. Every link in here is public and loads without a login.

---

Build me a single mobile-first landing page for Strive Elite, a weekly
at-home soccer training program for youth players, run by Coach Yinka in
Northern Virginia. This page is the destination for paid Instagram ads.
Its only job is to get a parent to watch the video and fill out the form.
One page, no nav, no footer links except Privacy and Terms.

## 1. Look and feel (match exactly)

- Background near-black #0d0d0d. Text white #ffffff. Secondary text
  white at 55% opacity. Card borders white at 8% opacity, card fill white
  at 2%.
- Accent gold #c8a858. Gold is used ONLY for: the word "ELITE" in the
  wordmark, one short rule under headings, and the highlighted phrase in
  the headline. Never gold on body text, never bright yellow, no gradients
  of gold.
- Fonts from Google Fonts: "Barlow Condensed" weight 800/900 for all
  headlines, uppercase; "Barlow" 500/600/700 for everything else.
  Small labels are uppercase with 0.2em letter-spacing.
- Rounded corners 16 to 20px on cards, pill buttons.
- Feels like a premium sports brand: calm, dark, confident. No stock
  photos, no emojis, no exclamation points, no countdown timers.
- Logo: https://thestriveapp.com/strive-logo-512.png (a white circle
  with a black ball mark and "STRIVE SOCCER"). Show it small, 44px, as a
  round coin next to the wordmark text "STRIVE ELITE" (STRIVE white,
  ELITE gold, Barlow Condensed 900).

## 2. Motion

- On load: the wordmark rises in (opacity 0 to 1, 14px up, slight blur
  to sharp, 0.7s), then a 96px gold hairline draws under it left to
  right, then the headline assembles word by word (each word rises 0.45em
  and unblurs, 55ms apart).
- Every section below the fold enters when it scrolls into view: text
  rises 18px and unblurs; cards and video tiles scale up from 96% and
  settle, siblings staggered 80 to 100ms apart.
- Easing cubic-bezier(0.2, 0.8, 0.2, 1), 0.7s. Nothing bounces or spins.
- Respect prefers-reduced-motion: plain fades only.

## 3. Page structure and exact copy (top to bottom)

### Header
Wordmark (logo coin + STRIVE ELITE). Top right, a small outlined pill
link "MEMBER SIGN IN" to https://thestriveapp.com/login.

### Video (first thing under the header)
The uploaded VSL, 16:9, full width, rounded corners. It must AUTOPLAY
MUTED the instant the page opens (that is the only autoplay phones allow),
with a centered overlay button on top: a dark pill reading "TAP FOR SOUND"
with a small gold dot. One tap: unmute, restart from 0:00, play with
sound, remove the overlay, show normal controls. Must work inline on
iPhone Safari (playsinline), no fullscreen takeover.

### Headline (H1, Barlow Condensed 800, about 34px on phones)
Team training 3-4x a week is not close to enough to achieve your goals.
The phrase "not close to enough" is in gold.

### Sub-headline (Barlow, 15px, white 55%)
Team practice is real work, but it's built for the whole group. Strive
Elite is the individual layer on top: a weekly plan built around what
your player specifically needs to reach the next level, not what fits 15
kids on one field.

### Section label: HOW IT WORKS
Four cards, 2 columns on tablet and up, 1 column on phones:

1. **4 sessions a week, built around you**
   Same rhythm every time, layered on top of regular training. You show
   up, it's already planned, you just train.
2. **Not built for the group. Built for you.**
   Every week targets what YOU actually need work on, not what's
   convenient for 15 kids on one field.
3. **Every drill, shown to you first**
   No guessing what a rep should look like. Watch it, then go do it.
4. **A weekly update, just for you**
   What got done, what's next. Nothing slips by quietly, ever.

### Section label: A TASTE OF IT
Five video tiles in a row on desktop, 2 per row on phones. Each tile is a
portrait-cropped video with a play badge and a label under it. Tapping
plays that clip inline, muted, looping. These are real drill videos from
the app, use them exactly:

| Label        | Video URL |
|--------------|-----------|
| Warm-ups     | https://thestriveapp.com/drills/plyo-pogo-jumps.mp4 |
| Ball Mastery | https://thestriveapp.com/drills/ball-mastery-juggle-catch.mp4 |
| Passing      | https://thestriveapp.com/drills/two-touch-passing.mp4 |
| Confidence   | https://thestriveapp.com/drills/wall-pass-touch-scissor.mp4 |
| 1v1 Skills   | https://thestriveapp.com/drills/neymar-feint.mp4 |

Under the tiles, small text: "Every drill in the plan looks like this.
The full bank is what your player actually trains from."

### Section label: FAIR QUESTIONS
Three cards, one column:

1. **Will they actually do it?**
   You get a recap every week. If it's not happening, you'll know
   immediately, not at the end of the season.
2. **We already train 3-4 times a week.**
   Group training is real work, but it can't target one kid's specific
   gap with a full team on the field. This is the individual layer on
   top, built around exactly what your player needs to reach the next
   level.
3. **What if we miss a week?**
   The plan picks back up the moment you're ready. No makeup schedule to
   manage, no falling behind.

### Offer block
A card with a gold 30% border and a faint gold fill, centered text:
- Large: **$350** then smaller "/mo"
- Line: "Starting Nov 2. Join by Nov 1 and lock $249/mo for life."
- Bold line: "Tell us about your player below. I'll personally reach out
  to get your call on the books."

### The form (the close)
Embed this GoHighLevel survey exactly, full width, white background,
rounded corners, minimum height 720px:

```html
<iframe
  src="https://api.leadconnectorhq.com/widget/survey/W14MZotX2vYkpyDPKOY8"
  style="border:none;width:100%;display:block;min-height:720px"
  scrolling="no"
  id="W14MZotX2vYkpyDPKOY8"
  title="Strive Elite intake"
  data-cookie-consent="true"
  data-cookie-consent-provider="auto"></iframe>
<script src="https://link.msgsndr.com/js/form_embed.js"></script>
```

Under the form, centered small text: or comment / DM "ELITE" on Instagram
Then: Already a member? Sign in to your dashboard (link to
https://thestriveapp.com/login)

### Footer
Tiny: Privacy (https://thestriveapp.com/privacy) and Terms
(https://thestriveapp.com/terms). Nothing else.

## 4. Technical

- Mobile first. Test at 390px wide. No horizontal scroll ever.
- Fast: lazy-load the drill tiles, preload only the VSL poster frame.
- Add a Meta Pixel slot in the head with a placeholder PIXEL_ID I can
  fill in, firing PageView on load and Lead when the GHL form submits.
- Page title: "Strive Elite". Description: "Training a lot doesn't help
  if it's never the thing your player actually needs."
- Open Graph image: use the first frame of the VSL.

## 5. Hard rules

- Never use the words "AI", "automated", "algorithm", or "generated"
  anywhere on the page. The plans are built and reviewed by Coach Yinka.
- No em dashes anywhere in the copy. Use periods, commas, or colons.
- Do not add testimonials, player names, college names, academy names,
  logos of clubs, star ratings, "as seen on", or any proof I have not
  given you here. Do not label anything "real" or "verified".
- Do not invent numbers, stats, guarantees, or deadlines. The only
  numbers on this page are the ones in this brief.
- Do not add a countdown, popup, exit intent, chat widget, or cookie
  banner.
- Keep the copy exactly as written. If something needs to change for
  layout, ask me first.
