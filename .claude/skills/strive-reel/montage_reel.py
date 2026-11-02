#!/usr/bin/env python3
"""Top-funnel reel from the drill bank: a montage of filmed drill clips with
the house overlays (hook, numbered list, watermark, end card).

  python3 montage_reel.py plan.json

plan.json (paths relative to the plan's folder):
  out        final .mp4
  fonts      folder with the brand TTFs
  outro      marketing/outro/strive-elite-outro-9s-vertical-1080x1920.mp4
  hook       {"eyebrow": "...", "lines": ["...", "..."], "end": 2.2}  (our hook:
             these are Strive's own drill clips, nothing of the coach's is on them)
  segments   [{"clip": "../../../public/drills/x.mp4", "in": 0, "out": 4.0,
               "num": "01", "text": "TAP, PULL, PUSH"}, ...]
             Each segment is one list item. The number lands when its clip
             starts (the first one when the hook ends).
  list_end   optional, seconds before the end where the list fades

Steps: cut and join the segments into source.mp4 (720x1280, 30 fps, silent,
same as the bank clips), write spec.json for reel_build.py, run the
zoom-only pass, the face track (python3.13 holds OpenCV here), then the
full build. Every file lands next to the plan.
"""
import json, os, shutil, subprocess, sys

PLAN = os.path.abspath(sys.argv[1]); D = os.path.dirname(PLAN); SK = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(PLAN))
FF = shutil.which("ffmpeg") or sys.exit("ffmpeg not on PATH")
PY_CV = next((p for p in ["/usr/local/bin/python3.13", shutil.which("python3")] if p and
              subprocess.run([p, "-c", "import cv2"], capture_output=True).returncode == 0), None)

segs = plan["segments"]
parts, starts, t = [], [], 0.0
for i, s in enumerate(segs):
    length = s["out"] - s["in"]
    starts.append(t); t += length
    parts.append(f"[{i}:v]trim=start={s['in']}:end={s['out']},setpts=PTS-STARTPTS,"
                 f"scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p[v{i}]")
fc = ";".join(parts) + ";" + "".join(f"[v{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0[v]"
inputs = []
for s in segs:
    inputs += ["-i", os.path.join(D, s["clip"])]
src = os.path.join(D, "source.mp4")
subprocess.run([FF, "-hide_banner", "-loglevel", "warning", "-y", *inputs, "-filter_complex", fc, "-map", "[v]",
                "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-movflags", "+faststart", src], check=True)
total = t
print(f"source.mp4: {len(segs)} segments, {total:.1f} s")

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
