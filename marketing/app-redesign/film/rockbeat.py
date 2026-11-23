"""A garage-rock boogie under the cut films, made from scratch (no samples, nothing
licensed, no melody taken from any song). Coach Yinka's Nov 21 ask: the vibe of the
fuzzy, hand-clapping desert boogie rock he sent, on the same 120 BPM grid the edits
are cut to, so the picture does not change.

python3 film/rockbeat.py info.json out.wav
info.json is the cut's CUT_INFO (mix.src.js): bpm, len, drop, tension, deviceOut,
end, mark, open, done, shimmer, flash, all in beats.

Before the drop: a feedback swell, a chord stab on every opening word, a snare
roll in. The drop: the band (double-tracked fuzz guitars playing a shuffle
boogie in E, bass, kick, snare with handclaps, shuffled hats, tambourine).
The count-in: muted chugs and a floor tom, a snare roll into the session.
The end: a stab and a crash per end word, one big ringing chord under the mark.
Done taps get a cowbell, the finish a crash.
"""
import json, sys, wave
import numpy as np

SR = 44100
info = json.load(open(sys.argv[1]))
BPM = info["bpm"]; B = 60 / BPM
N = int((info["len"] * B + 2.5) * SR)
rng = np.random.default_rng(11)
SWING = 0.58  # where the second eighth of each beat lands

L = {k: np.zeros(N) for k in ("gtrL", "gtrR", "bass", "drums", "perc")}

def at(beat): return int(round(beat * B * SR))
def swung(beat):  # beat may be x.5 -> push the offbeat eighth late
    whole = np.floor(beat); frac = beat - whole
    return whole + (SWING if abs(frac - 0.5) < 1e-6 else frac)
def add(track, sig, start, gain=1.0):
    if start >= N or start + len(sig) <= 0: return
    s0 = max(0, start); e = min(N, start + len(sig))
    L[track][s0:e] += sig[s0 - start: e - start] * gain
def env(n, decay): return np.exp(-np.arange(n) / (decay * SR))
def fade_in(n, t): return np.minimum(1, np.arange(n) / max(1, t * SR))

def eq(x, hp=None, lp=None, peak=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); g = np.ones_like(f)
    if hp: g *= 1 / np.sqrt(1 + (hp / np.maximum(f, 1)) ** 4)
    if lp: g *= 1 / np.sqrt(1 + (f / lp) ** 4)
    if peak:
        fc, gain_db, q = peak
        g *= 1 + (10 ** (gain_db / 20) - 1) * np.exp(-((np.log2(np.maximum(f, 1) / fc)) * q) ** 2)
    return np.fft.irfft(X * g, len(x))

# ---------- guitar ----------
def saw(freq, n, detune=0.0, vib=0.0):
    t = np.arange(n) / SR
    f = freq * (1 + detune) * (1 + vib * np.sin(2 * np.pi * 5.2 * t))
    ph = np.cumsum(f) / SR
    return 2 * (ph - np.floor(ph + 0.5))

def chord(root, dur, shape="5", mute=False, take=0, vib=0.0, attack=0.004):
    """Power chord on root (Hz): 5 = root+fifth+octave, 6 = root+sixth (boogie)."""
    n = int(dur * SR)
    iv = {"5": [1, 1.4983, 2], "6": [1, 1.6818, 2], "1": [1, 2]}[shape]
    s = np.zeros(n)
    for k, r in enumerate(iv):
        for d in (-0.0035, 0.0035):
            s += saw(root * r, n, d * (1 + 0.3 * take) + 0.001 * k, vib) * (0.9 if k == 0 else 0.7)
    s = np.tanh(s * (3.5 if mute else 6.0))           # the fuzz
    e = env(n, 0.07 if mute else dur * 0.9) * fade_in(n, attack)
    return s * e * (0.55 if mute else 0.8)

E2, A2, B2, G2, D3 = 82.41, 110.0, 123.47, 98.0, 146.83
# a generic shuffle boogie (the root-fifth / root-sixth rock-and-roll pattern), 4 bars
BARS = [E2, E2, A2, E2, B2, A2, E2, B2]

def boogie_bar(beat0, root, take, last=False):
    for i in range(8):
        b = beat0 + i / 2
        if t0 <= b < t1 or b >= dout: continue
        if last and i >= 6:  # a little turnaround on the last two eighths
            add("gtrL" if take == 0 else "gtrR", chord(root * (1.0 if i == 6 else 1.1225), 0.22, "5", True, take), at(swung(b)) + take * 330)
            continue
        shape = "5" if i % 2 == 0 else "6"
        add("gtrL" if take == 0 else "gtrR", chord(root, 0.26, shape, True, take), at(swung(b)) + take * 330)

def stab(beat, root=E2, ring=0.9, gain=1.0):
    for take, tr in ((0, "gtrL"), (1, "gtrR")):
        add(tr, chord(root, ring, "5", False, take, vib=0.002), at(beat) + take * 260, gain)

# ---------- bass ----------
def bassnote(freq, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(4 * np.pi * freq * t) + 0.15 * np.sign(np.sin(2 * np.pi * freq * t))
    return np.tanh(1.8 * s) * env(n, dur * 0.7) * fade_in(n, 0.003) * 0.5

# ---------- drums ----------
def kick():
    n = int(0.3 * SR); t = np.arange(n) / SR
    f = 55 + 95 * np.exp(-t / 0.025)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.09)
    beater = eq(rng.standard_normal(n), hp=1500, lp=5000) * env(n, 0.004) * 0.5
    return np.tanh(2.0 * (s + beater)) * 0.85

def snare(g=1.0):
    n = int(0.28 * SR); t = np.arange(n) / SR
    body = (np.sin(2 * np.pi * 190 * t) + 0.5 * np.sin(2 * np.pi * 330 * t)) * env(n, 0.03)
    wires = eq(rng.standard_normal(n), hp=1800, lp=9000) * env(n, 0.11)
    return (body * 0.5 + wires * 0.9) * 0.45 * g

def clap():
    n = int(0.25 * SR); s = np.zeros(n)
    for i, off in enumerate([0, 0.009, 0.019, 0.027]):
        k = int(off * SR); m = n - k
        s[k:] += eq(rng.standard_normal(m), hp=900, lp=6000, peak=(1400, 6, 1.2)) * env(m, 0.008 if i < 3 else 0.12)
    return s * 0.32

def hat(open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    return eq(rng.standard_normal(n), hp=7000) * env(n, 0.09 if open_ else 0.014) * 0.16

def tamb():
    n = int(0.12 * SR); t = np.arange(n) / SR
    jingles = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) for f in (5100, 6300, 7400, 8800))
    s = (eq(rng.standard_normal(n), hp=5500) + 0.25 * jingles) * env(n, 0.035) * fade_in(n, 0.004)
    return s * 0.09

def crash(dur=2.2, g=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    tones = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (403, 557, 741, 913, 1187, 1531))
    s = eq(rng.standard_normal(n) + 0.4 * tones, hp=3500, lp=14000) * env(n, dur * 0.35)
    return s * 0.22 * g

def tom():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 82 + 40 * np.exp(-t / 0.04)
    return np.tanh(1.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.16)) * 0.55

def cowbell():
    n = int(0.22 * SR); t = np.arange(n) / SR
    s = np.sign(np.sin(2 * np.pi * 562 * t)) + np.sign(np.sin(2 * np.pi * 845 * t))
    return eq(s, hp=400, lp=4500, peak=(800, 4, 1.5)) * env(n, 0.06) * 0.11

def roll(b0, b1, g0=0.25, g1=1.0):
    steps = int((b1 - b0) * 8)
    for i in range(steps):
        x = i / max(1, steps - 1)
        add("drums", snare(g0 + (g1 - g0) * x), at(b0 + i / 8))

def swell(dur):  # amp feedback on the octave, fading in with vibrato
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.tanh(4 * (np.sin(2 * np.pi * 329.6 * t * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t))) + 0.4 * np.sin(2 * np.pi * 659.2 * t)))
    return s * (t / dur) ** 2 * 0.22

K, CL = kick(), clap()
drop, (t0, t1), dout = info["drop"], info["tension"], info["deviceOut"]

# ---------- before the drop ----------
add("gtrL", swell(drop * B), 0); add("gtrR", swell(drop * B), int(0.01 * SR), 0.8)
for b in info["open"]:
    stab(b, E2, ring=0.6, gain=0.9); add("drums", K, at(b)); add("perc", crash(1.4, 0.7), at(b))
for b in np.arange(0, drop - 1, 1): add("perc", tamb(), at(swung(b + 0.5)))
roll(drop - 1, drop)

# ---------- the band ----------
for beat in np.arange(drop, dout, 0.5):
    tension = t0 <= beat < t1
    rel = beat - drop; bar = int(rel // 4); in_bar = rel - bar * 4
    if tension:  # count-in: muted chugs, floor tom, building
        x = (beat - t0) / max(1, t1 - t0)
        for take, tr in ((0, "gtrL"), (1, "gtrR")):
            add(tr, chord(E2, 0.18, "5", True, take), at(beat) + take * 330, 0.5 + 0.5 * x)
        if beat == int(beat):
            add("drums", tom(), at(beat), 0.6 + 0.4 * x); add("drums", K, at(beat), 0.7)
        continue
    if in_bar == 0:
        root = BARS[bar % len(BARS)]
        boogie_bar(beat, root, 0, last=(bar % 4 == 3)); boogie_bar(beat, root, 1, last=(bar % 4 == 3))
        if bar % 4 == 0: add("perc", crash(), at(beat))
    root = BARS[bar % len(BARS)]
    add("bass", bassnote(root / 2 * (1 if (beat * 2) % 2 == 0 else 2), 0.24), at(swung(beat)))
    if in_bar in (0, 2) or in_bar == 2.5: add("drums", K, at(swung(beat)))
    if in_bar in (1, 3): add("drums", snare(), at(beat)); add("perc", CL, at(beat), 0.9)
    add("perc", hat(open_=(in_bar == 3.5 and bar % 2 == 1)), at(swung(beat)), 1.0 if beat == int(beat) else 0.7)
    if beat != int(beat): add("perc", tamb(), at(swung(beat)))
roll(t1 - 1, t1, 0.3, 1.0)
add("perc", crash(), at(t1))
for b in info["flash"]: add("perc", crash(1.8, 0.8), at(b))

# ---------- the end ----------
for b in info["end"]:
    stab(b, E2, ring=0.55); add("drums", K, at(b)); add("drums", snare(1.1), at(b)); add("perc", crash(1.6, 0.9), at(b))
stab(info["mark"] - 0.75, E2, ring=4.0, gain=0.85); add("perc", crash(3.2, 0.8), at(info["mark"] - 0.75))
add("drums", K, at(info["mark"] - 0.75))

for b in info["done"]: add("perc", cowbell(), at(b))
for b in info["shimmer"]: add("perc", crash(2.4, 1.1), at(b))

# ---------- mix ----------
g_l = eq(L["gtrL"], hp=110, lp=4200, peak=(1800, 3, 1.0))
g_r = eq(L["gtrR"], hp=110, lp=4000, peak=(1500, 3, 1.0))
bass = eq(L["bass"], hp=35, lp=900)
drums = L["drums"]; perc = L["perc"]
left = 1.0 * g_l + 0.3 * g_r + 0.55 * bass + 0.8 * drums + perc * 1.1
right = 0.3 * g_l + 1.0 * g_r + 0.55 * bass + 0.8 * drums + perc * 1.2
st = np.stack([left, right], axis=1)
st = np.tanh(st / np.max(np.abs(st)) * 1.4) / np.tanh(1.4) * 0.89  # glue
fade = int(1.2 * SR); st[-fade:] *= np.linspace(1, 0, fade)[:, None]
pcm = (st * 32767).astype("<i2")
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("ok", N / SR)
