"""Synthesizes the outro sound bed: a whoosh on the gold sweep, a soft
impact when the mark lands, a two-note chime as the wordmark resolves,
and two light ticks for the rule and eyebrow. 48 kHz stereo WAV."""
import numpy as np, wave, sys

SR = 48000
DUR = 3.6
t = np.arange(int(SR * DUR)) / SR
L = np.zeros_like(t); R = np.zeros_like(t)
rng = np.random.default_rng(7)

def place(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); n = min(len(sig), len(t) - i)
    l = (1 - max(pan, 0)); r = (1 + min(pan, 0))
    L[i:i+n] += sig[:n] * gain * l; R[i:i+n] += sig[:n] * gain * r

def env(n, a, d, curve=3.0):
    x = np.linspace(0, 1, n); e = np.ones(n)
    ai = int(a * n); e[:ai] = np.linspace(0, 1, max(ai, 1))
    e[ai:] = np.exp(-curve * (x[ai:] - x[ai]) / max(d, 1e-6))
    return e

def bandpass_noise(n, f_lo, f_hi):
    x = rng.standard_normal(n)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    m = np.zeros_like(f); band = (f >= f_lo) & (f <= f_hi); m[band] = 1
    # soft edges
    m = np.convolve(m, np.ones(64) / 64, mode="same")
    return np.fft.irfft(X * m, n)

# 1. Whoosh 0.00 -> 0.75 s: noise whose band sweeps up then thins, panned left to right.
n = int(0.8 * SR); chunks = 24; whoosh = np.zeros(n); cl = n // chunks
for k in range(chunks):
    p = k / (chunks - 1)
    lo = 180 + 2600 * p ** 1.6; hi = lo * 2.6
    seg = bandpass_noise(cl * 2, lo, hi)
    win = np.hanning(cl * 2)
    s = k * cl; e = min(s + cl * 2, n)
    whoosh[s:e] += (seg * win)[: e - s]
whoosh *= env(n, 0.35, 0.5, 4.0)
whoosh /= np.abs(whoosh).max()
for k in range(0, n, 2400):  # pan sweep
    p = k / n
    seg = whoosh[k:k+2400]
    L[k:k+len(seg)] += seg * 0.95 * (1 - p * 0.8); R[k:k+len(seg)] += seg * 0.95 * (0.2 + p * 0.8)

# 2. Impact at 0.70 s: sub thump + short click.
n = int(0.6 * SR); x = np.arange(n) / SR
thump = np.sin(2 * np.pi * (58 + 40 * np.exp(-x * 18)) * x) * np.exp(-x * 9)
click = bandpass_noise(int(0.03 * SR), 1200, 6000) * env(int(0.03 * SR), 0.05, 0.3, 6)
place(thump, 0.70, 0.7); place(click, 0.70, 0.25)

# 3. Chime at 1.02 s: two soft notes a fifth apart, slight shimmer.
n = int(1.6 * SR); x = np.arange(n) / SR
def note(f, g): return (np.sin(2*np.pi*f*x) + 0.35*np.sin(2*np.pi*f*2*x) + 0.12*np.sin(2*np.pi*f*3*x)) * g
chime = (note(659.25, 1.0) + note(987.77, 0.7)) * np.exp(-x * 2.6) * env(n, 0.01, 1, 1)
chime /= np.abs(chime).max()
place(chime, 1.02, 0.28, 0.0)

# 4. Ticks at 1.47 s (rule) and 1.74 s (eyebrow).
def tick(f_lo, f_hi, ms):
    n = int(ms / 1000 * SR); return bandpass_noise(n, f_lo, f_hi) * env(n, 0.03, 0.4, 7)
tk = tick(2500, 7000, 45); tk /= np.abs(tk).max(); place(tk, 1.47, 0.16, 0.15)
tk2 = tick(1800, 5000, 55); tk2 /= np.abs(tk2).max(); place(tk2, 1.74, 0.13, -0.15)

# 5. Tail: a quiet low bed that fades with the picture.
n = len(t); x = t
bed = np.sin(2*np.pi*55*x) * 0.035 * np.clip((x - 0.7) / 0.4, 0, 1) * np.clip((3.55 - x) / 0.5, 0, 1)
L += bed; R += bed

mix = np.stack([L, R], 1)
mix = mix / np.abs(mix).max() * 0.71  # ~ -3 dBFS peak
pcm = (mix * 32767).astype("<i2")
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "outro.wav", "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
print("wrote", DUR, "s")
