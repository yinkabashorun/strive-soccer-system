# Strive Elite static ads: upload sheet (Oct 2026, VSL funnel)

Five 1080x1350 feed creatives in `final/`. Everything below is what Ads
Manager asks for per ad, in the order it asks. Copy and paste.

## Campaign setup (same for all five)

- Objective: Leads (form fill on thestriveapp.com/demo). If the pixel is
  not installed yet, run Traffic until it is, then switch.
- Destination URL, ads 1 to 4: `https://thestriveapp.com/demo?utm_source=meta&utm_medium=paid&utm_campaign=elite-vsl&utm_content=ad1`
  (change `ad1` to `ad2`, `ad3`, `ad4`). Ad 5: same with `utm_content=ad5-retarget`.
- Display link: thestriveapp.com/demo
- Placements: Instagram feed, Instagram Explore, Facebook feed. Skip Stories
  and Reels for these (they are 4:5, not 9:16).
- Cold audience (ads 1 to 4): parents 30 to 55, interests youth soccer,
  club soccer, MLS NEXT, ECNL, soccer training. Start with Northern Virginia
  plus a 25 mile radius, then open to the US once the first results are in.
- Retargeting audience (ad 5 only): anyone who visited thestriveapp.com/demo
  in the last 30 days, plus Instagram engagers 30 days. Exclude anyone who
  submitted the form.
- Pixel: installed on /demo (ID 1655175349021847, Oct 10). PageView on
  load, Lead on form submit. Build the ad 5 audience from it once it has
  seen traffic.
- Rules baked into every creative: no "AI" or "automated", no em dashes,
  no alumni names, no invented numbers. Month to month and same-day refund
  are confirmed. $249 locked for life by Nov 1, $350 after, confirmed.

## Ad 1: Tuesday night

File: `final/strive-elite-ad-1.png`
On the image: "This is what my players do at home on a Tuesday night."

Primary text:
```
Free 5 minute video: thestriveapp.com/demo

Your player trains hard at practice and still isn't getting better between practices. That's not effort. That's nobody telling him what to work on at home.

I build him a week. Four sessions, a video for every drill, and I see what gets done. Watch me walk through a real player's week, drill by drill.

thestriveapp.com/demo
```
Headline (40 characters max): `Watch a real week, drill by drill`
Description: `Free 5 minute video`
CTA button: Learn more

## Ad 2: Most parents can't coach it

File: `final/strive-elite-ad-2.png`
On the image: "Most parents can't coach it. You don't have to. Watch."

Primary text:
```
You don't have to know soccer to help your player get better. You need a plan you can trust and a coach who's actually looking.

Free 5 minute video of a real week, built from scratch: thestriveapp.com/demo

Four at-home sessions, every drill filmed, progress you can see, a text to you every week. Month to month.

thestriveapp.com/demo
```
Headline: `You don't have to coach it`
Description: `Free 5 minute video`
CTA button: Learn more

## Ad 3: I build four sessions a week

File: `final/strive-elite-ad-3.png`
On the image: "I build four sessions a week for every kid. Watch me build one."

Primary text:
```
Every player in Strive Elite gets a new week from me every Monday. Not a template. A week built around what they did last week and what they're working toward.

Watch me build one. Free 5 minute video: thestriveapp.com/demo

Four at-home sessions, about 40 minutes each, a video for every drill, and a text to you every week so nothing slips by quietly.

thestriveapp.com/demo
```
Headline: `A new week every Monday`
Description: `Built around your player`
CTA button: Learn more

## Ad 4: The exact week

File: `final/strive-elite-ad-4.png`
On the image: "Here's the exact week a 13-year-old trained last week."

Primary text:
```
Here's the exact week one of my players trained last week. Every drill, every video, what he finished, what he missed, and what I did about it.

Free 5 minute video: thestriveapp.com/demo

If you've ever wondered what your player should actually be doing between practices, this is it.

thestriveapp.com/demo
```
Headline: `The exact week, drill by drill`
Description: `Free 5 minute video`
CTA button: Learn more

## Ad 5: Retargeting, the offer

File: `final/strive-elite-ad-5.png`
On the image: "$249 a month. Locked for life." plus the Nov 1 / $350 line.
Runs ONLY to the retargeting audience above.

Primary text:
```
You watched the video. Here's the rest.

Strive Elite is $249 a month, locked for life if you join by Nov 1. $350 a month after that. Month to month, same-day refund if it's not for you.

Founding families are already training on it. Lock in your rate: thestriveapp.com/demo
```
Headline: `$249 a month, locked for life`
Description: `Join by Nov 1. $350 after.`
CTA button: Learn more

## Two things to confirm before these go live

1. Every creative and caption says "Free 5 minute video". The VSL script
   ran about 8 minutes. If the final edit is longer than about 5 minutes,
   change the line to "Free video" on the images (one word swap in each
   `src/adN.html`, re-render) and in the captions above.
2. Ad 4's image says "a 13-year-old". That has to match the real player
   whose week is shown in the VSL. If it does not, change it to the right
   age or to "one of my players".
