#!/usr/bin/env python3
"""Top-funnel reel from the drill bank: a montage of filmed drill clips with
the house overlays (hook, numbered list, watermark, end card).

  python3 montage_reel.py plan.json

plan.json (paths relative to the plan's folder):
  out          final .mp4
  fonts        folder with the brand TTFs
  outro        marketing/outro/strive-elite-outro-9s-vertical-1080x1920.mp4
  hook         {"eyebrow": "...", "lines": ["...", "..."], "end": 2.2}  (our hook:
               these are Strive's own drill clips, nothing of the coach's is on them)
  segments     [{"clip": "../../../public/drills/x.mp4", "in": 0, "out": 4.0,
                 "num": "01", "text": "TAP, PULL, PUSH",
                 "audio": "optional path to the clip WITH sound"}, ...]
               Each segment is one list item. The number lands when its clip
               starts (the first one when the hook ends).
  audio_commit optional git commit whose copy of each clip still has its
               audio track (36849aa is the bank before the Oct 25 mute).
               The bank files themselves stay silent; the reel gets the
               original sound (Coach Yinka, Nov 4 2026). A segment's own
               "audio" path wins over the commit; a clip with no sound in
               either place gets silence for its length.
  list_end     optional, seconds before the end where the list fades

Audio per segment is levelled to AUDIO_TARGET LUFS before the join (gain
capped at AUDIO_MAX_GAIN dB so a near-silent driveway clip does not become
hiss, and never past -1.5 dBTP), then reel_build.py normalises the whole
track once, linearly.

Steps: cut and join the segments into source.mp4 (720x1280, 30 fps, same
as the bank clips), write spec.json for reel_build.py, run the zoom-only
pass, the face track (python3.13 holds OpenCV here), then the full build.
Every file lands next to the plan; audio/ and source.mp4 are scratch and
not committed.
"""
import json, os, shutil, subprocess, sys

PLAN = os.path.abspath(sys.argv[1]); D = os.path.dirname(PLAN); SK = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(PLAN))
FF = shutil.which("ffmpeg") or sys.exit("ffmpeg not on PATH")
PY_CV = next((p for p in ["/usr/local/bin/python3.13", shutil.which("python3")] if p and
              subprocess.run([p, "-c", "import cv2"], capture_output=True).returncode == 0), None)
AUDIO_TARGET, AUDIO_MAX_GAIN, AUDIO_TP = -18.0, 18.0, -1.5

def probe(path):
    return subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
def has_audio(path):
    return "Audio:" in probe(path)
def loudness(path, t0, t1):
    r = subprocess.run([FF, "-hide_banner", "-nostats", "-ss", str(t0), "-to", str(t1), "-i", path,
                        "-af", "loudnorm=print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    j = json.loads(r[r.rindex("{"):])
    return float(j["input_i"]), float(j["input_tp"])

audio_commit = plan.get("audio_commit")
REPO = subprocess.run(["git", "-C", D, "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip()
AUD = os.path.join(D, "audio")
def audio_source(s):
    """The file whose sound this segment carries, or None for silence."""
    if s.get("audio"):
        p = os.path.join(D, s["audio"])
        return p if has_audio(p) else None
    if not audio_commit:
        return None
    os.makedirs(AUD, exist_ok=True)
    dest = os.path.join(AUD, os.path.basename(s["clip"]))
    if not os.path.exists(dest):
        rel = os.path.relpath(os.path.join(D, s["clip"]), REPO)
        r = subprocess.run(["git", "-C", REPO, "show", f"{audio_commit}:{rel}"], capture_output=True)
        if r.returncode != 0:
            return None
        open(dest, "wb").write(r.stdout)
    return dest if has_audio(dest) else None

segs = plan["segments"]
parts, starts, t = [], [], 0.0
inputs, aud_inputs, sounded = [], [], []
for i, s in enumerate(segs):
    length = s["out"] - s["in"]
    starts.append(t); t += length
    inputs += ["-i", os.path.join(D, s["clip"])]
    parts.append(f"[{i}:v]trim=start={s['in']}:end={s['out']},setpts=PTS-STARTPTS,"
                 f"scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p[v{i}]")
    src = audio_source(s)
    if src:
        I, tp = loudness(src, s["in"], s["out"])
        gain = min(AUDIO_TARGET - I, AUDIO_MAX_GAIN, AUDIO_TP - tp)
        j = len(segs) + len(aud_inputs) // 2; aud_inputs += ["-i", src]   # input index after the clips
        parts.append(f"[{j}:a]atrim=start={s['in']}:end={s['out']},asetpts=PTS-STARTPTS,volume={gain:.2f}dB,"
                     f"aformat=sample_rates=48000:channel_layouts=stereo[a{i}]")
        sounded.append(f"{s['num']} {I:.1f} LUFS {gain:+.1f} dB")
    else:
        parts.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{length},asetpts=PTS-STARTPTS[a{i}]")
        sounded.append(f"{s['num']} silent")
fc = ";".join(parts) + ";" + "".join(f"[v{i}][a{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=1[v][a]"
src = os.path.join(D, "source.mp4")
subprocess.run([FF, "-hide_banner", "-loglevel", "warning", "-y", *inputs, *aud_inputs, "-filter_complex", fc,
                "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", src], check=True)
total = t
print(f"source.mp4: {len(segs)} segments, {total:.1f} s; audio: " + ", ".join(sounded))

hook = plan.get("hook")
names = []
for i, s in enumerate(segs):
    start = starts[i]
    if i == 0 and hook:
        start = hook["end"] + 0.1
    names.append({"start": round(start, 2), "num": s["num"], "text": s["text"]})
spec = {
    "src": "source.mp4", "out": plan["out"], "fonts": plan["fonts"], "outro": plan["outro"], "faces": "faces.json",
    "keep_hook": False, "hook": {**hook, "hide_baked_until": 0} if hook else None,
    "list_style": "stack", "names": names, "punch": True, "watermark": True, "endcard": True, "captions": [],
    "list_end": round(total - plan.get("list_end", 0.4), 2),
    "loudness": -16,   # ambient drill sound, not speech; Instagram's own audio goes on top
}
if not hook:
    spec["keep_hook"] = True; spec.pop("hook")
json.dump(spec, open(os.path.join(D, "spec.json"), "w"), indent=2)

subprocess.run([sys.executable, os.path.join(SK, "reel_build.py"), os.path.join(D, "spec.json"), "--zoom-only"], check=True)
if PY_CV:
    subprocess.run([PY_CV, os.path.join(SK, "faces.py"), os.path.join(D, "zoomed.mp4"), os.path.join(D, "faces.json")], check=True)
else:
    print("no OpenCV found: faces.json left empty, check the frames by eye"); json.dump([], open(os.path.join(D, "faces.json"), "w"))
subprocess.run([sys.executable, os.path.join(SK, "reel_build.py"), os.path.join(D, "spec.json")], check=True)
os.remove(os.path.join(D, "zoomed.mp4"))
