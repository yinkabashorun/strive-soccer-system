"""Strive viral edit: brand captions + the three names, rendered with libass.
Transcript lines are the best read of the audio (no speech model host is
reachable from this environment); the ones marked SURE=False must be
checked by Coach Yinka before posting. Re-render = edit CAPS and run."""
import subprocess, sys, os

S = "."  # run from this folder; fonts/ holds the brand TTFs
FF = "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
SRC = "SOURCE_CLIP.mov"  # the original phone clip, not kept in the repo
MARK = "/home/user/strive-soccer-system/marketing/outro/src/mark-white.png"
OUT = sys.argv[1] if len(sys.argv) > 1 else f"{S}/strive-shooting-3-things.mp4"

GOLD = "&H0058A8C8"   # #c8a858 as BGR
WHITE = "&H00FFFFFF"
BLACK = "&H000D0D0D"

# (start, end, text, sure). Gold words wrapped in {g}...{/g}.
CAPS = [
    (2.15, 3.28, "THREE THINGS TO REMEMBER", True),
    (3.30, 4.05, "WHEN SHOOTING", False),
    (4.08, 5.38, "LEAN FORWARD WITH YOUR", False),
    (5.41, 6.60, "{g}CHEST OVER THE BALL{/g}", True),
    (6.66, 7.30, "SECOND", True),
    (7.33, 8.63, "{g}STRIKE WITH THE LACES{/g}", True),
    (8.64, 9.30, "AND THIRD", True),
    (9.43, 11.30, "KEEP YOUR {g}HEAD OVER THE BALL{/g}", False),
    (11.60, 12.40, "AND FOLLOW THROUGH", False),
]

# The three, accumulating top-left from the moment each is said.
NAMES = [
    (5.41, "01", "CHEST OVER THE BALL"),
    (7.33, "02", "STRIKE WITH THE LACES"),
    (9.60, "03", "HEAD OVER THE BALL"),
]

HOOK_END = 2.75   # baked-in phone text runs to ~2.7 s; the hook zoom hides it
DUR = 12.54

def ts(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def gold(text):
    return text.replace("{g}", "{\\c" + GOLD + "}").replace("{/g}", "{\\c" + WHITE + "}")

lines = []
# Hook: eyebrow + two-line headline, top area, fades out at HOOK_END.
lines.append(f"Dialogue: 2,{ts(0)},{ts(HOOK_END)},Eyebrow,,0,0,0,,{{\\an8\\pos(540,320)\\fad(150,200)}}STRIVE SOCCER")
lines.append(f"Dialogue: 2,{ts(0)},{ts(HOOK_END)},Hook,,0,0,0,,{{\\an8\\pos(540,392)\\fad(150,200)\\fscx96\\fscy96\\t(0,260,\\fscx100\\fscy100)}}SCORE 5X MORE GOALS\\NIN 30 SECONDS")

# Captions: pop in, bottom third.
for st, en, text, _sure in CAPS:
    lines.append(f"Dialogue: 3,{ts(st)},{ts(en)},Cap,,0,0,0,,{{\\an5\\pos(540,1470)\\fscx88\\fscy88\\t(0,110,\\fscx104\\fscy104)\\t(110,200,\\fscx100\\fscy100)\\fad(40,60)}}{gold(text)}")

# The three names, accumulating at top-left in one block.
y0 = 300
for i, (st, num, name) in enumerate(NAMES):
    y = y0 + i * 140
    lines.append(f"Dialogue: 4,{ts(st)},{ts(DUR)},Num,,0,0,0,,{{\\an7\\pos(64,{y})\\fad(120,0)}}{num}")
    lines.append(f"Dialogue: 4,{ts(st)},{ts(DUR)},Name,,0,0,0,,{{\\an7\\pos(64,{y+40})\\fad(120,0)\\move(40,{y+40},64,{y+40},0,220)}}{name}")

# Handle, bottom-left, with the gold underline (a drawn rectangle).
lines.append(f"Dialogue: 1,{ts(0)},{ts(DUR)},Handle,,0,0,0,,{{\\an7\\pos(64,1782)}}@STRIVESOCCERFC")
lines.append(f"Dialogue: 1,{ts(0)},{ts(DUR)},Rule,,0,0,0,,{{\\an7\\pos(64,1834)\\c{GOLD}\\p1}}m 0 0 l 340 0 l 340 5 l 0 5{{\\p0}}")

ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,Barlow Condensed Black,124,{WHITE},{WHITE},{BLACK},&H80000000,0,0,0,0,100,100,0,0,1,5,3,8,40,40,0,1
Style: Eyebrow,Barlow SemiBold,38,{GOLD},{GOLD},{BLACK},&H80000000,0,0,0,0,100,100,7,0,1,3,2,8,40,40,0,1
Style: Cap,Barlow Condensed Black,104,{WHITE},{WHITE},{BLACK},&H90000000,0,0,0,0,100,100,0,0,1,5,3,5,60,60,0,1
Style: Num,Barlow SemiBold,36,{GOLD},{GOLD},{BLACK},&H80000000,0,0,0,0,100,100,7,0,1,3,2,7,0,0,0,1
Style: Name,Barlow Condensed Black,76,{WHITE},{WHITE},{BLACK},&H90000000,0,0,0,0,100,100,0,0,1,4,3,7,0,0,0,1
Style: Handle,Barlow SemiBold,36,{WHITE},{WHITE},{BLACK},&H80000000,0,0,0,0,100,100,4,0,1,3,2,7,0,0,0,1
Style: Rule,Barlow SemiBold,30,{GOLD},{GOLD},{GOLD},&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(lines) + "\n"

open(f"{S}/captions.ass", "w").write(ass)

# Hook zoom (zoompan, per frame; "in" is the input frame index at 30 fps):
# 1.36x anchored low for the first HOOK_END seconds (hides the baked-in
# phone text at the top), easing back to 1.0 over 0.35 s. Then a small
# punch-in on each of the three names.
T = "(in/30)"
z = (f"1+0.36*(1-min(1,max(0,({T}-{HOOK_END})/0.35)))"
     f"+0.06*(min(1,max(0,({T}-5.41)/0.15))*between({T},5.41,6.60)"
     f"+min(1,max(0,({T}-7.33)/0.15))*between({T},7.33,8.63)"
     f"+min(1,max(0,({T}-9.60)/0.15))*between({T},9.60,11.30))")
bias = f"(0.5+0.5*(1-min(1,max(0,({T}-{HOOK_END})/0.35))))"
crop = (f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*{bias}'"
        f":d=1:s=1080x1920:fps=30")

vf = (f"{crop},scale=1080:1920:flags=lanczos,"
      f"ass={S}/captions.ass:fontsdir={S}/fonts,"
      f"overlay=x=W-w-56:y=H-h-96")

cmd = [FF, "-hide_banner", "-loglevel", "warning", "-y",
       "-i", SRC, "-i", MARK,
       "-filter_complex",
       f"[1:v]scale=124:-1[mk];[0:v]{crop},ass={S}/captions.ass:fontsdir={S}/fonts[v0];[v0][mk]overlay=x=W-w-60:y=1760[v]",
       "-map", "[v]", "-map", "0:a",
       "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
       "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
       "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUT]
subprocess.run(cmd, check=True)
print("wrote", OUT)
