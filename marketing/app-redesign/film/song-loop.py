# python3.13 film/song-loop.py /path/to/recording.mp4 /path/to/out.wav
# Makes the song run longer by playing it to beat B, then jumping back to beat A
# and playing on to the end. A and B are bar lines where the song measures almost
# the same (chroma + mel match), so the repeat sits on the beat and is hard to hear.
# Writes song-beats-loop.json (the beat times of the longer song: derived numbers
# only, safe for the public repo) next to this script, and the longer audio to
# out.wav, which is a label's song and is never committed.
import json, subprocess, sys, os
import numpy as np, soundfile as sf

A, B, XF = 49, 97, 0.012  # loop: beat 97 jumps back to beat 49; 12 ms crossfade at the joint
here = os.path.dirname(os.path.abspath(__file__))
beats = json.load(open(os.path.join(here, "song-beats.json")))["beats"]
rec, out = sys.argv[1], sys.argv[2]
tmp = out + ".src.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", rec, "-vn", "-ac", "2", "-ar", "48000", tmp], check=True)
y, sr = sf.read(tmp)
os.remove(tmp)
a, b, x = int(beats[A] * sr), int(beats[B] * sr), int(XF * sr)
head, tail = y[: b + x], y[a - x:]  # the crossfade runs from x before beat B to x after, against x before to x after beat A
ramp = np.linspace(0, 1, 2 * x)[:, None]
joint = head[-2 * x:] * (1 - ramp) + tail[: 2 * x] * ramp
sf.write(out, np.concatenate([head[: -2 * x], joint, tail[2 * x:]]), sr)
# so beat A of the tail lands exactly where beat B was
looped = beats[:B] + [beats[j] - beats[A] + beats[B] for j in range(A, len(beats))]
json.dump({"note": f"song-beats.json with the song looped: beat {B} jumps back to beat {A} (song-loop.py)",
           "bpm": json.load(open(os.path.join(here, "song-beats.json")))["bpm"], "loop": [A, B],
           "beats": [round(t, 4) for t in looped]}, open(os.path.join(here, "song-beats-loop.json"), "w"))
print("looped song", round(len(np.concatenate([head, tail])) / sr, 2), "s,", len(looped), "beats")
