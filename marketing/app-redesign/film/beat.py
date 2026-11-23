"""The beat under the cut films, made from scratch (no samples, nothing licensed).

python3 film/beat.py info.json out.wav
info.json is the cut's CUT_INFO (mix.src.js): bpm, len, drop, tension, deviceOut,
end, mark, open, done, shimmer, flash, all in beats.

A dark 120 BPM drill-style loop: kick, 808 in E, claps on 2 and 4, eighth hats
with rolls. Hats and a riser before the drop; kick only through the count-in;
the full beat under the sessions; one hit per end word; a soft tail on the mark.
Done taps get a short wooden pop, the finish a shimmer.
"""
import json, sys
import numpy as np

SR = 44100
info = json.load(open(sys.argv[1]))
BPM = info["bpm"]; B = 60 / BPM; STEP = B / 4
N = int((info["len"] * B + 1.5) * SR)
out = np.zeros(N)
rng = np.random.default_rng(7)

def at(beat): return int(round(beat * B * SR))
def add(sig, start, gain=1.0):
    if start >= N: return
    end = min(N, start + len(sig)); out[start:end] += sig[: end - start] * gain
def env(n, decay): return np.exp(-np.arange(n) / (decay * SR))
def smooth(x, k):
    k = max(1, int(k)); return np.convolve(x, np.ones(k) / k, mode="same")

def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 50 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * env(n, 0.16)
    click = rng.standard_normal(n) * env(n, 0.0025) * 0.35
    return np.tanh(1.6 * (s + click)) * 0.9

def sub(freq, dur=0.9, glide_from=None):
    n = int(dur * SR); t = np.arange(n) / SR
    f = np.full(n, freq)
    if glide_from: f = freq + (glide_from - freq) * np.exp(-t / 0.06)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, dur * 0.45)
    s *= np.minimum(1, np.arange(n) / (0.004 * SR))
    return np.tanh(2.2 * s) * 0.55

def clap():
    n = int(0.3 * SR); s = np.zeros(n)
    for i, off in enumerate([0, 0.011, 0.022]):
        k = int(off * SR); m = n - k
        nz = rng.standard_normal(m); nz = nz - smooth(nz, 6); nz = smooth(nz, 2)
        s[k:] += nz * env(m, 0.012 if i < 2 else 0.16)
    return s * 0.32

def hat(open_=False):
    n = int((0.16 if open_ else 0.04) * SR)
    nz = rng.standard_normal(n); nz = nz - smooth(nz, 3)
    return nz * env(n, 0.05 if open_ else 0.009) * 0.13

def riser(beats):
    n = int(beats * B * SR); t = np.linspace(0, 1, n)
    nz = rng.standard_normal(n)
    dark = smooth(nz, 40); bright = nz - smooth(nz, 8)
    s = (dark * (1 - t) * 3 + bright * t) * (t ** 2.2)
    return s * 0.12

def pop():
    n = int(0.09 * SR); t = np.arange(n) / SR
    f = 950 * np.exp(-t / 0.05) + 520
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.018)
    return s * 0.28

def shimmer():
    n = int(1.3 * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for f, g in [(1760, 1), (2637, 0.7), (3520, 0.5), (4699, 0.35)]:
        s += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * g * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
    nz = rng.standard_normal(n); nz = nz - smooth(nz, 3)
    s = (s * 0.05 + nz * 0.03) * env(n, 0.42) * np.minimum(1, t / 0.03)
    return s

def swell(dur=1.6):
    n = int(dur * SR); t = np.linspace(0, 1, n)
    nz = smooth(rng.standard_normal(n), 30)
    return nz * np.sin(np.pi * t) ** 2 * 0.35

K, CL = kick(), clap()
notes = [41.2, 41.2, 49.0, 36.7]  # E1 E1 G1 D1, one per bar
drop, (t0, t1), dout = info["drop"], info["tension"], info["deviceOut"]

# before the drop: hats and a riser, a hit on every open word
for b in np.arange(0, drop, 0.5): add(hat(), at(b), 0.8)
add(riser(drop), 0, 1.0)
for b in info["open"]: add(K, at(b), 0.8); add(sub(41.2, 0.7, 80), at(b), 0.8)

# the beat
bar0 = drop
for s16 in range(int((dout - drop) * 4)):
    beat = drop + s16 / 4
    step = s16 % 16; bar = s16 // 16
    tension = t0 <= beat < t1
    if step in (0, 6, 10):
        add(K, at(beat))
        if not tension: add(sub(notes[bar % 4], 0.85 if step == 0 else 0.55, notes[bar % 4] * 1.9 if step == 0 else None), at(beat))
    if tension: continue
    if step in (4, 12): add(CL, at(beat))
    if step % 2 == 0: add(hat(), at(beat), 1.0 if step % 4 == 2 else 0.7)
    if bar % 2 == 1 and step in (13, 14, 15): add(hat(), at(beat), 0.6)
    if step == 14 and bar % 4 == 3: add(hat(True), at(beat), 0.9)
if t1 > t0: add(riser(t1 - t0), at(t0), 0.9)

# the end: one hit per word, a tail under the mark
for b in info["end"]: add(K, at(b), 0.9); add(sub(36.7, 1.1, 70), at(b), 0.9); add(CL, at(b), 0.6)
add(swell(), at(info["mark"]) - int(0.4 * SR), 0.6)

for b in info["done"]: add(pop(), at(b))
for b in info["shimmer"]: add(shimmer(), at(b))
for b in info["flash"]: add(sub(30.9, 0.6, 60), at(b), 0.7)

out /= max(1e-9, np.max(np.abs(out))) / 0.89
pcm = (np.stack([out, out], axis=1) * 32767).astype("<i2")
import wave
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("ok", len(out) / SR)
