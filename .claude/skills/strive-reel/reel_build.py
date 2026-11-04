#!/usr/bin/env python3
"""Strive reel builder. Reads a spec.json, writes the finished reel.

  python3 reel_build.py spec.json

Spec keys (see SKILL.md for the rules behind them):
  src            path to the coach's clip (.mov/.mp4, any phone format)
  out            output .mp4
  fonts          folder with the brand TTFs (Barlow-*.ttf, BarlowCondensed-*.ttf)
  outro          marketing/outro/strive-elite-outro-9s-vertical-1080x1920.mp4 (end swish)
  faces          faces.json from faces.py (run on the zoom-only pass)
  keep_hook      true = the coach's own on-screen hook stays untouched (default true)
  hook           optional, only when keep_hook is false AND the coach asked for ours:
                 {"eyebrow": "STRIVE SOCCER", "lines": ["...", "..."], "end": 2.75,
                  "hide_baked_until": 2.75}
  names          [{"start": 5.41, "num": "01", "text": "CHEST OVER THE BALL"}, ...]
  list_end       optional time the stacked list fades (default: the clip end)
  list_style     "stack" (the numbered list builds up and stays; the coach's
                 preferred style) or "pops" (each name alone, two lines, ~2 s)
  punch          true = a small punch-in zoom when each name lands (default true)
  watermark      true = STRIVE ELITE / PERSONALIZED REMOTE TRAINING bottom-right
  endcard        true = 2.4 s end card with DM US "ELITE" and the outro swish
  captions       [] (default). Only filled from lines the coach SENT, never guessed.
                 [{"start":..,"end":..,"text":".."}]; gold with {g}..{/g}.
  loudness       integrated loudness target in LUFS (default -14, speech; a
                 montage of ambient drill sound uses -16). Two-pass, linear.

Every overlay sits inside the SAFE box: clear of the Instagram and TikTok
top bar, the right-hand icon column and the caption / handle area at the
bottom (Coach Yinka, Nov 4 2026: "make sure text placement makes sense for
Instagram and TikTok"). The watermark sits bottom-left just above the
caption area, where a handle normally reads.
"""
import json, subprocess, sys, re, os

spec = json.load(open(sys.argv[1]))
D = os.path.dirname(os.path.abspath(sys.argv[1]))
def P(k, default=None):
    v = spec.get(k, default)
    return os.path.join(D, v) if isinstance(v, str) and not os.path.isabs(v) and k in ("src", "out", "fonts", "outro", "faces") else v

import shutil
FF = next((p for p in ["/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2",
                       shutil.which("ffmpeg")] if p and os.path.exists(p)), None)
if not FF:
    sys.exit("no ffmpeg found (imageio-ffmpeg binary or ffmpeg on PATH)")
SRC, OUT, FONTS, OUTRO = P("src"), P("out"), P("fonts"), P("outro")
GOLD = "&H0058A8C8"; WHITE = "&H00FFFFFF"; BLACK = "&H000D0D0D"; DIM = "&H00D9D9D9"
MARGIN = 24
# Type (Coach Yinka, Nov 4 2026: "a more premium Nike font ... sleek"):
# Oswald Bold for every big line (the open-licence twin of Trade Gothic
# Bold Condensed, Nike's long-time apparel and retail face), Inter for the
# small lines. Both ship in the skill's fonts/ folder with their OFL files.
DISPLAY, SMALL, SMALL_MED = "Oswald", "Inter SemiBold", "Inter Medium"
WIDTH_EM = 0.46          # Oswald Bold, uppercase, average advance per character
# Finish: crisp white type with NO outline, sitting on a soft dark haze (a
# blurred copy of the same text one layer below). The old hard outline read
# cheap; this is the sleek version he asked for.
GLOW = "\\c&H000000&\\1a&H50&\\blur10\\bord6\\3c&H000000&\\3a&H50&"
# Social safe box on the 1080x1920 canvas. Instagram Reels and TikTok draw
# their own UI over the top ~250 px, a column of icons down the right edge
# (x > ~950 from mid-height down) and the handle, caption and audio line
# over the bottom ~450 px. Text and the list stay inside this box; the
# watermark takes the strip just under it, bottom-left.
SAFE_L, SAFE_R, SAFE_T, SAFE_B = 60, 920, 270, 1360
SAFE_CX = (SAFE_L + SAFE_R) // 2
WM_Y = 1440   # baseline of STRIVE ELITE; the sub line sits under it, above the caption area

def duration(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])

DUR = duration(SRC)
def has_audio(path):
    # Drill clips are encoded silent (-an, Oct 25 rule); a montage of them has
    # no audio stream, so the mix starts from silence instead of failing.
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    return "Audio:" in r
SRC_AUDIO = has_audio(SRC)
keep_hook = spec.get("keep_hook", True)
hook = None if keep_hook else spec.get("hook")
HIDE = (hook or {}).get("hide_baked_until", 0) if hook else 0
names = spec.get("names", [])
style = spec.get("list_style", "stack")
punch = spec.get("punch", True)
END_CARD = 2.4 if spec.get("endcard", True) else 0
XFADE = 0.3

faces = json.load(open(P("faces"))) if spec.get("faces") and os.path.exists(P("faces")) else []
def face_boxes(t0, t1):
    # YuNet boxes on a head-to-toe shot run about 90 to 150 px wide; anything
    # under 60 px is a bystander or noise, not the player.
    return [f["face"] for f in faces if t0 <= f["t"] <= t1 and f["face"] and f["face"][2] >= 60]
def clear(rect, t0, t1):
    # Every face sample in the window must miss the rectangle (plus margin).
    # Checked box by box, not as one union, so a face that roams left then
    # right does not block a corner it never actually reaches.
    x0, y0, x1, y1 = rect
    for bx, by, bw, bh in face_boxes(t0, t1):
        fx0, fy0, fx1, fy1 = bx - MARGIN, by - MARGIN, bx + bw + MARGIN, by + bh + MARGIN
        if not (x1 <= fx0 or x0 >= fx1 or y1 <= fy0 or y0 >= fy1):
            return False
    return True
def hits(rect, t0, t1):
    # How many face samples in the window the rectangle (plus margin) touches.
    x0, y0, x1, y1 = rect; n = 0
    for bx, by, bw, bh in face_boxes(t0, t1):
        fx0, fy0, fx1, fy1 = bx - MARGIN, by - MARGIN, bx + bw + MARGIN, by + bh + MARGIN
        if not (x1 <= fx0 or x0 >= fx1 or y1 <= fy0 or y0 >= fy1):
            n += 1
    return n
def pick(cands, w, h, t0, t1, label):
    for x, y in cands:
        if clear((x, y, x + w, y + h), t0, t1):
            print(f"{label}: ({x},{y})"); return x, y
    print(f"{label}: no clear spot in {len(cands)} candidates, using the last"); return cands[-1]
def ts(t): return f"{int(t//3600)}:{int(t%3600//60):02d}:{t%60:05.2f}"
def width(text, size): return int(WIDTH_EM * size * len(text))
def gold(text): return text.replace("{g}", "{\\c" + GOLD + "}").replace("{/g}", "{\\c" + WHITE + "}")

ev = []
def say(layer, t0, t1, style, tag, text, glow=True):
    """One overlay line: the haze copy on `layer`, the crisp text one layer up."""
    if glow:
        ev.append(f"Dialogue: {layer},{ts(t0)},{ts(t1)},{style},,0,0,0,,{{{tag}{GLOW}}}{text}")
    ev.append(f"Dialogue: {layer+1},{ts(t0)},{ts(t1)},{style},,0,0,0,,{{{tag}}}{text}")
if hook:
    # Lower middle first (faces live in the upper half of a filmed drill),
    # then the top of the safe box, then the middle. Centred on the safe
    # box, not the canvas, so the right-hand icon column never touches it.
    HW, HH = SAFE_R - SAFE_L, 300
    hx, hy = pick([(SAFE_L, 960), (SAFE_L, SAFE_T + 30), (SAFE_L, 640)], HW, HH, 0, hook["end"], "hook")
    cy = hy + 150
    hook_text = "\\N".join(hook["lines"])
    say(2, 0, hook["end"], "Eyebrow", f"\\an5\\pos({SAFE_CX},{cy-130})\\fad(150,200)", hook.get("eyebrow", "STRIVE SOCCER"))
    say(2, 0, hook["end"], "Hook", f"\\an5\\pos({SAFE_CX},{cy+20})\\fad(150,200)\\fscx96\\fscy96\\t(0,260,\\fscx100\\fscy100)", hook_text)

for c in spec.get("captions", []):
    say(4, c["start"], c["end"], "Cap", f"\\an5\\pos({SAFE_CX},{SAFE_B-70})\\fscx88\\fscy88\\t(0,110,\\fscx104\\fscy104)\\t(110,200,\\fscx100\\fscy100)\\fad(40,60)", gold(c["text"]))

if names and style == "stack":
    # The numbered list builds up and stays. Tries the big size first, then a
    # smaller one, across the candidate spots; a clip where the face roams the
    # upper half gets the smaller list in a corner rather than text on him.
    t0 = names[0]["start"]; t1 = spec.get("list_end") or DUR
    placed = None
    # Layouts in order of preference: number above the name (big, then
    # smaller), then number inline with the name (compact, for a top
    # corner the face only grazes). Corners first; lower spots last.
    layouts = [("over", 72, 136), ("over", 60, 104), ("inline", 60, 78), ("inline", 50, 66), ("inline", 46, 60)]
    # Spots inside the safe box: top corners, a little lower, mid-height,
    # then anchored to the bottom of the box ("bottom" = y so the list ends
    # at SAFE_B), then right-mid and left-mid. Never past SAFE_R, so the
    # list clears the icon column, and never under SAFE_T, clear of the top bar.
    spots = [("tl", SAFE_T + 20), ("tr", SAFE_T + 20), ("tl", SAFE_T + 90), ("tr", SAFE_T + 90), ("tl", 520), ("tr", 520),
             ("bl", "bottom"), ("br", "bottom"), ("br", 760), ("bl", 760)]
    for side, y0 in spots:
        for layout, size, step in layouts:
            extra = 5 if layout == "inline" else 0            # "01  " in front
            w = max(width(n["text"], size) + int(0.36 * size * extra) for n in names); h = step * len(names)
            y = SAFE_B - h if y0 == "bottom" else y0
            if y < SAFE_T or y + h > SAFE_B:
                continue
            x = SAFE_L + 4 if side.endswith("l") else SAFE_R - w
            if clear((x, y, x + w, y + h), t0, t1):
                placed = (x, y, size, step, w, layout); break
        if placed: break
    if not placed:
        # No spot is clear for the whole list window (a player who roams the
        # frame for 20 s). Take the spot the face reaches least often, in the
        # smallest layouts, and say how often; then look at the frames.
        scored = []
        for order, (side, y0) in enumerate(spots):
            for layout, size, step in layouts[2:]:
                extra = 5 if layout == "inline" else 0
                w = max(width(n["text"], size) + int(0.36 * size * extra) for n in names); h = step * len(names)
                y = SAFE_B - h if y0 == "bottom" else y0
                if y < SAFE_T or y + h > SAFE_B:
                    continue
                x = SAFE_L + 4 if side.endswith("l") else SAFE_R - w
                scored.append((hits((x, y, x + w, y + h), t0, t1), order, (x, y, size, step, w, layout)))
        n_hits, _, placed = min(scored)
        print(f"stack: no clear spot, least covered: face reaches it in {n_hits} of {len(face_boxes(t0, t1))} samples")
    x, y, size, step, w, layout = placed
    print(f"stack: ({x},{y}) size {size} {layout}")
    right = x > 540; an = 9 if right else 7; ax = x + w if right else x
    for i, n in enumerate(names):
        yy = y + i * step
        pop = "\\fscx90\\fscy90\\t(0,140,\\fscx100\\fscy100)"
        if layout == "over":
            say(6, n["start"], t1, "Num", f"\\an{an}\\pos({ax},{yy})\\fad(120,160)", n["num"])
            say(6, n["start"], t1, "Stack", f"\\an{an}\\pos({ax},{yy+40})\\fad(120,160)\\fs{size}{pop}", n["text"])
        else:
            num = f"{{\\fn{SMALL}\\fs{int(size*0.42)}\\c{GOLD}\\fsp5}}{n['num']}{{\\r\\fs{size}}}  "
            say(6, n["start"], t1, "Stack", f"\\an{an}\\pos({ax},{yy})\\fad(120,160)\\fs{size}{pop}", f"{num}{n['text']}")
    names_done = True
elif names:
    for i, n in enumerate(names):
        en = n.get("end") or (names[i + 1]["start"] - 0.1 if i + 1 < len(names) else DUR - 0.8)
        words = n["text"].split(); half = (len(words) + 1) // 2
        l1, l2 = " ".join(words[:half]), " ".join(words[half:])
        w, h = 330, 230
        rx = SAFE_R - w
        x, y = pick([(rx, 600), (rx, 760), (SAFE_L, 600), (SAFE_L, 760), (rx, SAFE_B - h), (SAFE_L, SAFE_B - h)], w, h, n["start"], en, f"name {n['num']}")
        right = x > 540; an = 9 if right else 7; ax = x + w if right else x
        say(6, n["start"], en, "Num", f"\\an{an}\\pos({ax},{y})\\fad(120,160)", n["num"])
        say(6, n["start"], en, "Name", f"\\an{an}\\pos({ax},{y+40})\\fad(120,160)\\fscx90\\fscy90\\t(0,140,\\fscx100\\fscy100)", f"{l1}\\N{l2}")

if spec.get("watermark", True):
    # Bottom-left, just above where Instagram and TikTok print the handle and
    # caption, and well clear of the icon column on the right.
    say(0, 0, DUR, "Wm", f"\\an1\\pos({SAFE_L},{WM_Y})", f"STRIVE {{\\c{GOLD}}}ELITE")
    say(0, 0, DUR, "WmSub", f"\\an1\\pos({SAFE_L},{WM_Y+40})", "PERSONALIZED REMOTE TRAINING")

styles = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,{DISPLAY},128,{WHITE},{WHITE},{BLACK},&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1
Style: Eyebrow,{SMALL},30,{GOLD},{GOLD},{BLACK},&H00000000,0,0,0,0,100,100,6,0,1,0,0,5,40,40,0,1
Style: Cap,{DISPLAY},100,{WHITE},{WHITE},{BLACK},&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1
Style: Num,{SMALL},30,{GOLD},{GOLD},{BLACK},&H00000000,0,0,0,0,100,100,5,0,1,0,0,7,0,0,0,1
Style: Stack,{DISPLAY},72,{WHITE},{WHITE},{BLACK},&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Name,{DISPLAY},84,{WHITE},{WHITE},{BLACK},&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Wm,{DISPLAY},54,{WHITE},{WHITE},{BLACK},&H00000000,0,0,0,0,100,100,1,0,1,0,0,3,0,0,0,1
Style: WmSub,{SMALL_MED},22,{DIM},{DIM},{BLACK},&H00000000,0,0,0,0,100,100,4,0,1,0,0,3,0,0,0,1
Style: EndTitle,{DISPLAY},176,{WHITE},{WHITE},{BLACK},&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,0,0,0,1
Style: EndSub,{SMALL},32,{WHITE},{WHITE},{BLACK},&H00000000,0,0,0,0,100,100,9,0,1,0,0,5,0,0,0,1
Style: EndUrl,{SMALL_MED},30,{DIM},{DIM},{BLACK},&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,0,0,0,1
Style: Rule,{SMALL_MED},30,{GOLD},{GOLD},{GOLD},&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
open(f"{D}/overlays.ass", "w").write(styles + "\n".join(ev) + "\n")

E = END_CARD
end_ev = [
    f"Dialogue: 1,{ts(0)},{ts(E)},EndTitle,,0,0,0,,{{\\an5\\pos(540,880)\\fad(200,0)\\fscx94\\fscy94\\t(0,300,\\fscx100\\fscy100)}}STRIVE {{\\c{GOLD}}}ELITE",
    f"Dialogue: 1,{ts(0.15)},{ts(E)},Rule,,0,0,0,,{{\\an5\\pos(540,990)\\fad(200,0)\\p1}}m 0 0 l 96 0 l 96 4 l 0 4{{\\p0}}",
    f"Dialogue: 1,{ts(0.3)},{ts(E)},EndSub,,0,0,0,,{{\\an5\\pos(540,1050)\\fad(220,0)}}PERSONALIZED REMOTE TRAINING",
    f"Dialogue: 1,{ts(0.55)},{ts(E)},EndSub,,0,0,0,,{{\\an5\\pos(540,1150)\\fad(220,0)}}DM US {{\\c{GOLD}}}\"ELITE\"",
    f"Dialogue: 1,{ts(0.7)},{ts(E)},EndUrl,,0,0,0,,{{\\an5\\pos(540,1215)\\fad(220,0)}}thestriveapp.com/demo",
]
open(f"{D}/endcard.ass", "w").write(styles + "\n".join(end_ev) + "\n")

# Zoom: optional hook zoom (only when we were asked to hide a baked-in
# title), plus a small punch-in as each name lands.
T = "(in/30)"
z = "1"
if HIDE:
    z += f"+0.36*(1-min(1,max(0,({T}-{HIDE})/0.35)))"
if punch and names:
    terms = []
    for i, n in enumerate(names):
        en = n.get("end") or (names[i + 1]["start"] - 0.1 if i + 1 < len(names) else min(DUR, n["start"] + 1.8))
        terms.append(f"min(1,max(0,({T}-{n['start']})/0.15))*between({T},{n['start']},{en})")
    z += "+0.06*(" + "+".join(terms) + ")"
bias = f"(0.5+0.5*(1-min(1,max(0,({T}-{HIDE})/0.35))))" if HIDE else "0.5"
zoom = f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*{bias}':d=1:s=1080x1920:fps=30"

if "--zoom-only" in sys.argv:
    subprocess.run([FF, "-hide_banner", "-loglevel", "warning", "-y", "-i", SRC, "-vf", zoom, "-an",
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", f"{D}/zoomed.mp4"], check=True)
    print("wrote", f"{D}/zoomed.mp4"); sys.exit(0)

main = f"[0:v]{zoom},ass={D}/overlays.ass:fontsdir={FONTS},format=yuv420p[main]"
LOUD = spec.get("loudness", -14)
def loudnorm_pass():
    """Two-pass loudnorm: measure, then apply one linear gain (LRA target wide
    so it never falls back to the dynamic mode, which pumps a quiet clip up
    between touches). A silent track is passed through untouched."""
    base = f"loudnorm=I={LOUD}:TP=-1.5:LRA=20"
    r = subprocess.run([FF, "-hide_banner", "-nostats", "-i", SRC, "-vn", "-af", base + ":print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
    m = json.loads(r[r.rindex("{"):].replace("-inf", "-99"))
    if float(m["input_i"]) < -70:
        print("audio: silent source, no normalisation"); return "[0:a]anull"
    print(f"audio: {float(m['input_i']):.1f} LUFS -> {LOUD} LUFS, linear")
    return (f"[0:a]{base}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
            f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
audio_main = (loudnorm_pass() + ",aformat=sample_rates=48000:channel_layouts=stereo" if SRC_AUDIO
              else f"anullsrc=r=48000:cl=stereo,atrim=0:{DUR},asetpts=PTS-STARTPTS")
if E:
    off = DUR - XFADE
    fc = (f"{main};color=c=0x0d0d0d:s=1080x1920:r=30:d={E}[blk];"
          f"[blk]ass={D}/endcard.ass:fontsdir={FONTS},format=yuv420p[card];"
          f"[main][card]xfade=transition=fade:duration={XFADE}:offset={off}[v];"
          f"{audio_main}[a0];[1:a]atrim=6.2:{6.2+E+XFADE},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a1];"
          f"[a0][a1]acrossfade=d={XFADE}[a]")
    inputs = ["-i", SRC, "-i", OUTRO]
else:
    fc = f"{main};{audio_main}[a];[main]null[v]"
    inputs = ["-i", SRC]
cmd = [FF, "-hide_banner", "-loglevel", "warning", "-y", *inputs, "-filter_complex", fc,
       "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
       "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUT]
subprocess.run(cmd, check=True)
print("wrote", OUT)
