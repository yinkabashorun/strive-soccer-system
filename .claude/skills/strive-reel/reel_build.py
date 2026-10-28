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
"""
import json, subprocess, sys, re, os

spec = json.load(open(sys.argv[1]))
D = os.path.dirname(os.path.abspath(sys.argv[1]))
def P(k, default=None):
    v = spec.get(k, default)
    return os.path.join(D, v) if isinstance(v, str) and not os.path.isabs(v) and k in ("src", "out", "fonts", "outro", "faces") else v

FF = "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
SRC, OUT, FONTS, OUTRO = P("src"), P("out"), P("fonts"), P("outro")
GOLD = "&H0058A8C8"; WHITE = "&H00FFFFFF"; BLACK = "&H000D0D0D"; DIM = "&H00D9D9D9"
MARGIN = 24

def duration(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])

DUR = duration(SRC)
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
    return [f["face"] for f in faces if t0 <= f["t"] <= t1 and f["face"] and f["face"][2] >= 150]
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
def pick(cands, w, h, t0, t1, label):
    for x, y in cands:
        if clear((x, y, x + w, y + h), t0, t1):
            print(f"{label}: ({x},{y})"); return x, y
    print(f"{label}: no clear spot in {len(cands)} candidates, using the last"); return cands[-1]
def ts(t): return f"{int(t//3600)}:{int(t%3600//60):02d}:{t%60:05.2f}"
def width(text, size): return int(0.36 * size * len(text))   # Barlow Condensed Black, uppercase
def gold(text): return text.replace("{g}", "{\\c" + GOLD + "}").replace("{/g}", "{\\c" + WHITE + "}")

ev = []
if hook:
    hx, hy = pick([(60, 1000), (60, 260), (60, 1250)], 960, 300, 0, hook["end"], "hook")
    cy = hy + 150
    hook_text = "\\N".join(hook["lines"])
    ev.append(f"Dialogue: 2,{ts(0)},{ts(hook['end'])},Eyebrow,,0,0,0,,{{\\an5\\pos(540,{cy-120})\\fad(150,200)}}{hook.get('eyebrow','STRIVE SOCCER')}")
    ev.append(f"Dialogue: 2,{ts(0)},{ts(hook['end'])},Hook,,0,0,0,,{{\\an5\\pos(540,{cy+20})\\fad(150,200)\\fscx96\\fscy96\\t(0,260,\\fscx100\\fscy100)}}{hook_text}")

for c in spec.get("captions", []):
    ev.append(f"Dialogue: 3,{ts(c['start'])},{ts(c['end'])},Cap,,0,0,0,,{{\\an5\\pos(540,1470)\\fscx88\\fscy88\\t(0,110,\\fscx104\\fscy104)\\t(110,200,\\fscx100\\fscy100)\\fad(40,60)}}{gold(c['text'])}")

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
    spots = [("tl", 40), ("tr", 40), ("tl", 24), ("tr", 24), ("tl", 220), ("tr", 220), ("bl", 1120), ("br", 1120), ("br", 760), ("bl", 760)]
    for side, y in spots:
        for layout, size, step in layouts:
            extra = 5 if layout == "inline" else 0            # "01  " in front
            w = max(width(n["text"], size) + int(0.36 * size * extra) for n in names); h = step * len(names)
            x = 64 if side.endswith("l") else 1016 - w
            if clear((x, y, x + w, y + h), t0, t1):
                placed = (x, y, size, step, w, layout); break
        if placed: break
    if not placed:
        size, step = 60, 104; w = max(width(n["text"], size) for n in names)
        placed = (1016 - w, 760, size, step, w, "over"); print("stack: no clear spot, using right-mid")
    x, y, size, step, w, layout = placed
    print(f"stack: ({x},{y}) size {size} {layout}")
    right = x > 540; an = 9 if right else 7; ax = x + w if right else x
    for i, n in enumerate(names):
        yy = y + i * step
        pop = "\\fscx90\\fscy90\\t(0,140,\\fscx100\\fscy100)"
        if layout == "over":
            ev.append(f"Dialogue: 4,{ts(n['start'])},{ts(t1)},Num,,0,0,0,,{{\\an{an}\\pos({ax},{yy})\\fad(120,160)}}{n['num']}")
            ev.append(f"Dialogue: 4,{ts(n['start'])},{ts(t1)},Stack,,0,0,0,,{{\\an{an}\\pos({ax},{yy+40})\\fad(120,160)\\fs{size}{pop}}}{n['text']}")
        else:
            num = f"{{\\fnBarlow SemiBold\\fs{int(size*0.5)}\\c{GOLD}\\fsp6}}{n['num']}{{\\r\\fs{size}}}  "
            ev.append(f"Dialogue: 4,{ts(n['start'])},{ts(t1)},Stack,,0,0,0,,{{\\an{an}\\pos({ax},{yy})\\fad(120,160)\\fs{size}{pop}}}{num}{n['text']}")
    names_done = True
elif names:
    for i, n in enumerate(names):
        en = n.get("end") or (names[i + 1]["start"] - 0.1 if i + 1 < len(names) else DUR - 0.8)
        words = n["text"].split(); half = (len(words) + 1) // 2
        l1, l2 = " ".join(words[:half]), " ".join(words[half:])
        w, h = 330, 230
        x, y = pick([(720, 600), (720, 760), (40, 600), (40, 760), (720, 1150), (40, 1150)], w, h, n["start"], en, f"name {n['num']}")
        right = x > 540; an = 9 if right else 7; ax = x + w if right else x
        ev.append(f"Dialogue: 4,{ts(n['start'])},{ts(en)},Num,,0,0,0,,{{\\an{an}\\pos({ax},{y})\\fad(120,160)}}{n['num']}")
        ev.append(f"Dialogue: 4,{ts(n['start'])},{ts(en)},Name,,0,0,0,,{{\\an{an}\\pos({ax},{y+40})\\fad(120,160)\\fscx90\\fscy90\\t(0,140,\\fscx100\\fscy100)}}{l1}\\N{l2}")

if spec.get("watermark", True):
    ev.append(f"Dialogue: 1,{ts(0)},{ts(DUR)},Wm,,0,0,0,,{{\\an3\\pos(1030,1800)}}STRIVE {{\\c{GOLD}}}ELITE")
    ev.append(f"Dialogue: 1,{ts(0)},{ts(DUR)},WmSub,,0,0,0,,{{\\an3\\pos(1030,1844)}}PERSONALIZED REMOTE TRAINING")

styles = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,Barlow Condensed Black,124,{WHITE},{WHITE},{BLACK},&H80000000,0,0,0,0,100,100,0,0,1,5,3,5,40,40,0,1
Style: Eyebrow,Barlow SemiBold,38,{GOLD},{GOLD},{BLACK},&H80000000,0,0,0,0,100,100,7,0,1,3,2,5,40,40,0,1
Style: Cap,Barlow Condensed Black,104,{WHITE},{WHITE},{BLACK},&H90000000,0,0,0,0,100,100,0,0,1,5,3,5,60,60,0,1
Style: Num,Barlow SemiBold,36,{GOLD},{GOLD},{BLACK},&H80000000,0,0,0,0,100,100,7,0,1,3,2,7,0,0,0,1
Style: Stack,Barlow Condensed Black,72,{WHITE},{WHITE},{BLACK},&H90000000,0,0,0,0,100,100,0,0,1,4,3,7,0,0,0,1
Style: Name,Barlow Condensed Black,84,{WHITE},{WHITE},{BLACK},&H90000000,0,0,0,0,100,100,0,0,1,4,3,7,0,0,0,1
Style: Wm,Barlow Condensed Black,54,{WHITE},{WHITE},{BLACK},&H80000000,0,0,0,0,100,100,1,0,1,3,2,3,0,0,0,1
Style: WmSub,Barlow SemiBold,26,{DIM},{DIM},{BLACK},&H80000000,0,0,0,0,100,100,4,0,1,2,1,3,0,0,0,1
Style: EndTitle,Barlow Condensed Black,170,{WHITE},{WHITE},{BLACK},&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,0,0,0,1
Style: EndSub,Barlow SemiBold,34,{WHITE},{WHITE},{BLACK},&H00000000,0,0,0,0,100,100,8,0,1,0,0,5,0,0,0,1
Style: EndUrl,Barlow Medium,32,{DIM},{DIM},{BLACK},&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,0,0,0,1
Style: Rule,Barlow Medium,30,{GOLD},{GOLD},{GOLD},&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

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
audio_main = "[0:a]loudnorm=I=-14:TP=-1.5:LRA=11,aformat=sample_rates=48000:channel_layouts=stereo"
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
