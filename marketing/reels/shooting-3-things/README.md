# Shooting: three things (reel edit, Oct 28 2026)

Source: Coach Yinka's 12.5 s phone clip (a player talking to camera, a
phone-app title baked into the first 2.7 s). Output:
strive-shooting-3-things.mp4, 1080x1920, 30 fps, H.264 + AAC, audio
loudness normalised to -14 LUFS for Instagram.

What the edit does: a 1.36x hook zoom for the first 2.7 s hides the
baked-in title and replaces it with the brand hook (gold STRIVE SOCCER
eyebrow, white Barlow Condensed Black headline); pop captions in Barlow
Condensed Black with the three names in brand gold; the three names stack
top-left as they are said (01 / 02 / 03 gold eyebrow numbers); a small
punch-in on each; @STRIVESOCCERFC with the gold underline bottom-left and
the white mark bottom-right. No bars, no bright yellow, no em dashes.

Re-render: edit CAPS / NAMES in build.py (times in seconds) and run
`python3 build.py out.mp4`. The script expects the brand TTFs in a fonts/
folder next to it (converted from marketing/outro/src/fonts/*.woff2 with
fontTools) and the source clip path at the top.

Transcript note: no speech model host is reachable from the build
environment, so the caption words are a best read of the audio. Lines
marked sure=False in build.py must be checked against the audio before
posting.
