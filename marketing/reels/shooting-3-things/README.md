# Shooting: three things (reel, Oct 28 2026)

Source: Coach Yinka's 12.5 s phone clip (a player talking to camera, a
phone-app title baked into the first 2.7 s). Output:
strive-shooting-3-things.mp4, 1080x1920, 30 fps, 14.9 s, H.264 + AAC,
speech normalised to -14 LUFS.

THE HOUSE REEL STYLE (approved by Coach Yinka Oct 28):
- No spoken-word captions from us. Coach Yinka adds his own.
- Hook: a 1.36x zoom for the first 2.7 s hides the baked-in title; the
  brand hook (gold STRIVE SOCCER eyebrow, white Barlow Condensed Black
  headline) is placed wherever his face is not.
- The three names: single pop-up cards, two short lines, gold 01 / 02 /
  03, beside him at shoulder height, with a small punch-in on each.
- FACE RULE: nothing ever covers his face. faces.py tracks the face on
  the zoom-only pass; build.py checks every overlay's window against the
  face boxes (plus a 40 px margin) and takes the first clear candidate
  position, best first. The chosen spots print when it runs.
- Watermark: STRIVE ELITE (ELITE in gold) over PERSONALIZED REMOTE
  TRAINING, bottom-right, the whole clip.
- End card, 2.4 s with a 0.3 s crossfade: STRIVE ELITE, gold rule,
  PERSONALIZED REMOTE TRAINING, DM US "ELITE", thestriveapp.com/demo,
  with the outro's end swish from marketing/outro.
- No bars, no bright yellow, no em dashes.

Build: set SRC in build.py; render the zoom-only pass; run faces.py on
it; run `python3 build.py`. Fonts: convert marketing/outro/src/fonts/
*.woff2 to TTF with fontTools into a fonts/ folder next to build.py.
