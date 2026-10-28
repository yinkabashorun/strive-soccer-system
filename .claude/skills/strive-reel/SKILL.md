---
name: strive-reel
description: Build a Strive Instagram reel from a clip Coach Yinka sends: brand overlays (the numbered 1 2 3 list, optional hook), face-aware placement so nothing covers the player's face, the Strive Elite personalized remote training watermark, and the 2.4 s end card. Use whenever he sends a video and says edit, reel, captions, overlays, make it viral, name the points, add the watermark or the outro.
---

# Strive reel

What Coach Yinka approved on Oct 28 2026, with the two corrections he gave
the same day. Follow it exactly; change it only on his word.

## Before touching the clip

1. **Never remove or cover anything he put in the clip** (a title from his
   phone app, his own captions, a sticker) without asking first. On Oct 28
   the clip carried his hook "Score 5x More Goals In 30 Seconds" and the
   first build hid it under a zoom and replaced it. Wrong. His hook stays.
   `keep_hook: true` is the default; only set it false when he asked.
2. **Never guess spoken words.** No speech model host is reachable from
   the build environment, and a best read produced wrong captions. He
   adds his own captions in his app. Only fill `captions` from lines he
   sent, word for word.
3. Ask what the points are if he did not name them. He names the 1 2 3;
   you do not infer them from the audio.

## The look

- Fonts: Barlow Condensed Black for anything big, Barlow SemiBold tracked
  for eyebrows, Barlow Medium for small lines. TTFs are converted from
  `marketing/outro/src/fonts/*.woff2` with fontTools (see Build).
- Colours: white text, dark outline (#0d0d0d), brand gold #c8a858 only on
  the numbers, one key word, the rule and ELITE. No bright yellow, no bars
  over the video, no em dashes.
- **The list, his preferred style:** gold `01 / 02 / 03` eyebrow numbers,
  the name in white Barlow Condensed Black under each, building up as each
  point is said and staying to the end (`list_style: "stack"`). A small
  punch-in (6%) when each lands. `"pops"` (one name at a time, two short
  lines) exists for clips with no room for a stack.
- **Watermark:** STRIVE ELITE (ELITE gold) over PERSONALIZED REMOTE
  TRAINING, bottom-right, the whole clip. Not the Strive Soccer handle, not
  the ball mark; he rejected those.
- **End card:** 2.4 s, brand black, STRIVE ELITE, gold rule, PERSONALIZED
  REMOTE TRAINING, DM US "ELITE", thestriveapp.com/demo, 0.3 s crossfade,
  carrying the end swish from `marketing/outro/strive-elite-outro-9s-vertical-1080x1920.mp4`.
- Speech loudness normalised to -14 LUFS. Output 1080x1920, 30 fps, H.264,
  AAC, faststart.

## The face rule

Nothing ever covers the player's face. `faces.py` tracks the face with
OpenCV (Haar frontal, profile as fallback) on the zoom-only pass; the
builder checks every overlay's on-screen window against the union of face
boxes in that window plus a 40 px margin and takes the first clear
candidate position (stack: top-left, top-right, right-mid, left-mid,
lower-left, lower-right). It prints where each overlay landed; look at
frames at each point's time before sending. Some clips will not have a
clean spot; say so rather than covering the face.

## Build

```
pip install opencv-python-headless<5 fonttools brotli   # once per environment
mkdir -p <reel>/fonts && python3 - <<'EOF'                # once: brand TTFs
from fontTools.ttLib import TTFont; import glob, os
for f in glob.glob('marketing/outro/src/fonts/*.woff2'):
    t = TTFont(f); t.flavor = None; t.save('<reel>/fonts/' + os.path.basename(f)[:-6] + '.ttf')
EOF
python3 .claude/skills/strive-reel/reel_build.py <reel>/spec.json --zoom-only
python3 .claude/skills/strive-reel/faces.py <reel>/zoomed.mp4 <reel>/faces.json
python3 .claude/skills/strive-reel/reel_build.py <reel>/spec.json
```

`spec.json` (paths relative to the spec's folder):

```json
{
  "src": "SOURCE_CLIP.mov", "out": "reel.mp4", "fonts": "fonts",
  "outro": "../../outro/strive-elite-outro-9s-vertical-1080x1920.mp4",
  "faces": "faces.json", "keep_hook": true, "list_style": "stack",
  "names": [{"start": 5.41, "num": "01", "text": "CHEST OVER THE BALL"}],
  "watermark": true, "endcard": true, "captions": []
}
```

Timings for `names` come from the audio (pocketsphinx keyword spotting
with the phrases he named works for timing even though it cannot be
trusted for words) or from him. Keep the reel folder under
`marketing/reels/<name>/` with the spec, faces.json, the two .ass files
and the final MP4; the source clip is not committed. Send the MP4 with
SendUserFile and record the build in CLAUDE.md.
