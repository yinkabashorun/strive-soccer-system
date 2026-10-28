"""Strive reel build, v2 (Oct 28 2026): no spoken-word captions (Coach
Yinka adds his own), face-aware placement of the hook and the three
names, a Strive Elite personalized remote training watermark, and a 2.4 s
end card with the outro's end swish.

Face-aware rule: faces.json (OpenCV Haar, every 3rd frame on the zoomed
pass) gives the face box over time. Every overlay window is checked
against the union of face boxes inside that window plus a margin; a
candidate position that touches it is rejected and the next candidate is
tried. Candidates per overlay are listed below, best first.
"""
import json, subprocess, sys, os

S = "."  # run from this folder; fonts/ holds the brand TTFs, faces.json from faces.py
FF = "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
SRC = "SOURCE_CLIP.mov"  # the original phone clip, not kept in the repo
OUTRO = "../../outro/strive-elite-outro-9s-vertical-1080x1920.mp4"  # end swish
OUT = sys.argv[1] if len(sys.argv) > 1 else f"{S}/strive-shooting-3-things.mp4"

GOLD = "&H0058A8C8"; WHITE = "&H00FFFFFF"; BLACK = "&H000D0D0D"; DIM = "&H00D9D9D9"
DUR = 12.54; HOOK_END = 2.75; END_CARD = 2.4; XFADE = 0.3
MARGIN = 40

NAMES = [  # (start, end, number, line1, line2)
    (5.41, 7.25, "01", "CHEST OVER", "THE BALL"),
    (7.33, 9.45, "02", "STRIKE WITH", "THE LACES"),
    (9.60, 11.70, "03", "HEAD OVER", "THE BALL"),
]

faces = json.load(open(f"{S}/faces.json"))
def face_union(t0, t1):
    boxes = [f["face"] for f in faces if t0 <= f["t"] <= t1 and f["face"] and f["face"][2] >= 150]
    if not boxes: return None
    x0 = min(b[0] for b in boxes) - MARGIN; y0 = min(b[1] for b in boxes) - MARGIN
    x1 = max(b[0] + b[2] for b in boxes) + MARGIN; y1 = max(b[1] + b[3] for b in boxes) + MARGIN
    return (x0, y0, x1, y1)

def clear(rect, t0, t1):
    fu = face_union(t0, t1)
    if not fu: return True
    x0, y0, x1, y1 = rect; fx0, fy0, fx1, fy1 = fu
    return x1 <= fx0 or x0 >= fx1 or y1 <= fy0 or y0 >= fy1

def pick(cands, w, h, t0, t1, label):
    for (x, y) in cands:
        if clear((x, y, x + w, y + h), t0, t1):
            print(f"{label}: at ({x},{y})")
            return x, y
    print(f"{label}: NO clear spot, using last candidate")
    return cands[-1]

def ts(t):
    return f"{int(t//3600)}:{int(t%3600//60):02d}:{t%60:05.2f}"

ev = []
# Hook (two lines, centred). Candidates: upper middle, then lower middle.
hx, hy = pick([(60, 1000), (60, 300), (60, 1250)], 960, 300, 0, HOOK_END, "hook")
cy = hy + 150
ev.append(f"Dialogue: 2,{ts(0)},{ts(HOOK_END)},Eyebrow,,0,0,0,,{{\\an5\\pos(540,{cy-120})\\fad(150,200)}}STRIVE SOCCER")
ev.append(f"Dialogue: 2,{ts(0)},{ts(HOOK_END)},Hook,,0,0,0,,{{\\an5\\pos(540,{cy+20})\\fad(150,200)\\fscx96\\fscy96\\t(0,260,\\fscx100\\fscy100)}}SCORE 5X MORE GOALS\\NIN 30 SECONDS")

# The three names: single pop-up cards, two short lines, beside him.
# Candidates: right side at shoulder height, left side, then lower right.
for st, en, num, l1, l2 in NAMES:
    w, h = 330, 230
    x, y = pick([(720, 600), (720, 760), (40, 600), (40, 760), (720, 1150), (40, 1150)], w, h, st, en, f"name {num}")
    right = x > 540
    an = 9 if right else 7          # anchor top-right or top-left
    ax = x + w if right else x
    ev.append(f"Dialogue: 4,{ts(st)},{ts(en)},Num,,0,0,0,,{{\\an{an}\\pos({ax},{y})\\fad(120,160)}}{num}")
    ev.append(f"Dialogue: 4,{ts(st)},{ts(en)},Name,,0,0,0,,{{\\an{an}\\pos({ax},{y+40})\\fad(120,160)\\fscx90\\fscy90\\t(0,140,\\fscx100\\fscy100)}}{l1}\\N{l2}")

# Watermark, bottom-right, the whole clip.
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
Style: Num,Barlow SemiBold,36,{GOLD},{GOLD},{BLACK},&H80000000,0,0,0,0,100,100,7,0,1,3,2,7,0,0,0,1
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
open(f"{S}/overlays.ass", "w").write(styles + "\n".join(ev) + "\n")

# End card: its own ASS over a brand-black source.
E = END_CARD
end_ev = [
    f"Dialogue: 1,{ts(0)},{ts(E)},EndTitle,,0,0,0,,{{\\an5\\pos(540,880)\\fad(200,0)\\fscx94\\fscy94\\t(0,300,\\fscx100\\fscy100)}}STRIVE {{\\c{GOLD}}}ELITE",
    f"Dialogue: 1,{ts(0.15)},{ts(E)},Rule,,0,0,0,,{{\\an5\\pos(540,990)\\fad(200,0)\\p1}}m 0 0 l 96 0 l 96 4 l 0 4{{\\p0}}",
    f"Dialogue: 1,{ts(0.3)},{ts(E)},EndSub,,0,0,0,,{{\\an5\\pos(540,1050)\\fad(220,0)}}PERSONALIZED REMOTE TRAINING",
    f"Dialogue: 1,{ts(0.55)},{ts(E)},EndSub,,0,0,0,,{{\\an5\\pos(540,1150)\\fad(220,0)}}DM US {{\\c{GOLD}}}\"ELITE\"",
    f"Dialogue: 1,{ts(0.7)},{ts(E)},EndUrl,,0,0,0,,{{\\an5\\pos(540,1215)\\fad(220,0)}}thestriveapp.com/demo",
]
open(f"{S}/endcard.ass", "w").write(styles + "\n".join(end_ev) + "\n")

T = "(in/30)"
z = (f"1+0.36*(1-min(1,max(0,({T}-{HOOK_END})/0.35)))"
     f"+0.06*(min(1,max(0,({T}-5.41)/0.15))*between({T},5.41,6.60)"
     f"+min(1,max(0,({T}-7.33)/0.15))*between({T},7.33,8.63)"
     f"+min(1,max(0,({T}-9.60)/0.15))*between({T},9.60,11.30))")
bias = f"(0.5+0.5*(1-min(1,max(0,({T}-{HOOK_END})/0.35))))"
zoom = f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*{bias}':d=1:s=1080x1920:fps=30"

off = DUR - XFADE
fc = (
    f"[0:v]{zoom},ass={S}/overlays.ass:fontsdir={S}/fonts,format=yuv420p[main];"
    f"color=c=0x0d0d0d:s=1080x1920:r=30:d={E}[blk];"
    f"[blk]ass={S}/endcard.ass:fontsdir={S}/fonts,format=yuv420p[card];"
    f"[main][card]xfade=transition=fade:duration={XFADE}:offset={off}[v];"
    f"[0:a]loudnorm=I=-14:TP=-1.5:LRA=11,aformat=sample_rates=48000:channel_layouts=stereo[a0];"
    f"[1:a]atrim=6.2:{6.2+E+XFADE},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a1];"
    f"[a0][a1]acrossfade=d={XFADE}[a]"
)
cmd = [FF, "-hide_banner", "-loglevel", "warning", "-y", "-i", SRC, "-i", OUTRO,
       "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
       "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
       "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUT]
subprocess.run(cmd, check=True)
print("wrote", OUT)
