"""Calm swoosh-only sound bed (Nike-quiet: pure air, no tones, few cues) for site-build-9s.html (9.0 s). Every cue
is a soft, low-passed air sweep: no clicks, no mallets, no pad, no chime.
A barely-there air bed keeps the silence from feeling dead. Peaks held
around -8 dBFS so it never fights a voice."""
import numpy as np, wave, sys

SR = 48000; DUR = 9.0
t = np.arange(int(SR * DUR)) / SR
L = np.zeros_like(t); R = np.zeros_like(t)
rng = np.random.default_rng(31)

def place(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); n = min(len(sig), len(t) - i)
    L[i:i+n] += sig[:n] * gain * (1 - max(pan, 0)); R[i:i+n] += sig[:n] * gain * (1 + min(pan, 0))

def lowpass(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (f / cutoff) ** 4), len(x))

def bp_noise(n, lo, hi):
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR)
    m = ((f >= lo) & (f <= hi)).astype(float); m = np.convolve(m, np.ones(400) / 400, mode="same")
    return np.fft.irfft(X * m, n)

def swoosh(dur, f0, f1, attack=0.45, chunks=24, lp=3000):
    """Smooth air sweep: band-limited noise whose center glides f0 -> f1,
    with a slow sine-shaped rise and a long tail. Always soft-edged."""
    n = int(dur * SR); out = np.zeros(n); cl = max(n // chunks, 1)
    for k in range(chunks):
        p = k / max(chunks - 1, 1); c = f0 + (f1 - f0) * (p ** 1.3 if f1 > f0 else 1 - (1 - p) ** 1.3)
        seg = bp_noise(cl * 2, c * 0.6, c * 1.7) * np.hanning(cl * 2); s = k * cl; e = min(s + cl * 2, n)
        out[s:e] += seg[: e - s]
    a = int(attack * n)
    env = np.ones(n); env[:a] = np.sin(np.linspace(0, np.pi / 2, max(a, 1))) ** 2
    env[a:] = np.cos(np.linspace(0, np.pi / 2, n - a)) ** 1.6
    out = lowpass(out * env, lp); return out / (np.abs(out).max() + 1e-9)

def pan_sweep(sig, at, gain, p0, p1):
    """Place a swoosh while gliding its pan from p0 to p1 (-1 left .. 1 right)."""
    i = int(at * SR); n = min(len(sig), len(t) - i); step = 1200
    for k in range(0, n, step):
        p = p0 + (p1 - p0) * (k / n); seg = sig[k:min(k + step, n)]
        L[i+k:i+k+len(seg)] += seg * gain * (1 - max(p, 0)); R[i+k:i+k+len(seg)] += seg * gain * (1 + min(p, 0))

def sub_swell(dur, f=48):
    n = int(dur * SR); x = np.arange(n) / SR
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return lowpass(np.sin(2 * np.pi * f * x) * e, 120)

# air bed: barely there, dark, fades with the picture
bed = lowpass(rng.standard_normal(len(t)), 400)
bed = bed / np.abs(bed).max() * 0.03 * np.clip((t - 0.1) / 1.4, 0, 1) * np.clip((8.9 - t) / 1.0, 0, 1)
L += bed; R += bed

# Fewer, softer, longer. No tones at all: pure air.
# 0.00 phone rises: one long low swish, left to right
pan_sweep(swoosh(1.3, 120, 700, 0.55, 40, 2200), 0.0, 0.5, -0.5, 0.5)
# 1.15 headline writes itself: one slow drift under the words
pan_sweep(swoosh(1.5, 350, 1200, 0.55, 40, 2600), 1.12, 0.22, -0.3, 0.3)
# 2.50 cards: a single longer swish that covers the four slides, right to center
pan_sweep(swoosh(1.1, 800, 300, 0.4, 40, 2400), 2.45, 0.22, 0.6, 0.0)
# 3.60 tiles: one light swish stepping left to right
pan_sweep(swoosh(0.9, 700, 1600, 0.45, 40, 3000), 3.55, 0.14, -0.5, 0.5)
# 4.70 CTA: a slow rise, no thump
pan_sweep(swoosh(1.0, 160, 900, 0.6, 40, 2200), 4.5, 0.3, -0.2, 0.2)
# 5.50 sheen: high whisper across the glass
pan_sweep(swoosh(1.2, 1400, 2800, 0.5, 40, 4000), 5.45, 0.07, -0.8, 0.8)
# 6.00 phone recedes: falling swish
pan_sweep(swoosh(0.9, 1100, 140, 0.35, 40, 2200), 6.0, 0.24, 0.2, -0.2)
# 6.40 end card: one big slow swish that opens wide, nothing else
pan_sweep(swoosh(1.7, 160, 1100, 0.6, 50, 2600), 6.3, 0.4, -0.6, 0.6)

mix = np.stack([lowpass(L, 7000), lowpass(R, 7000)], 1)
mix = mix / np.abs(mix).max() * 0.2   # ~ -14 dBFS peak, Nike-quiet
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "site-9s.wav", "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", DUR)
