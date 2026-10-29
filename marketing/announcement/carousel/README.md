# Strive Elite launch carousel (Oct 29 2026)

Seven slides, 1080x1350 (4:5 feed), announcing Strive Elite at the
founding price. Pairs with the main post caption in
`../strive-elite-announcement.md` (comment or DM ELITE; link in bio to
thestriveapp.com/demo).

1. Cover: Strive Elite is open. "Coach Gary and I put everything we know
   about training alone into one place."
2. The week: a new week every Monday, four sessions in season, six in
   the off-season, every drill on video, built for one player.
3. What a session looks like: warm-up, Keep It Up, three drills,
   finisher.
4. What's in it: Extra Work, Send a Clip, Side by Side, Pick up where
   you left off, Strength finishers, Any space.
5. Seven courses in the app today: Keep It Up, Weak Foot, Strength,
   Speed, Recruiting, College, Academy.
6. $249/mo locked for life. Join by Nov 1. $500/mo from Nov 2. Month to
   month, same-day refund.
7. DM "ELITE": call booked, the demo page, the Nov 1 line.

Every fact matches thestriveapp.com/demo and the announcement post.
Rules kept: "your player" never "your child", "we" wherever Coach Gary
is in the picture, nothing on calls, the guarantee, pay in full or
courses that are not in the app, no alumni, no em dashes, no AI words.

Files: `carousel.html` (source, `?slide=N`), `render-carousel.mjs`
(Chrome headless, writes `slides/NN.png`), `slides/01.png` to
`slides/07.png` (post these in order), `carousel-preview.png` (all
seven at a glance).

Rebuild: `node render-carousel.mjs 7` from this folder (CHROME env or
the Playwright chromium).
