"""Sound bed for site-build-9s.html (9.0 s). Every cue is timed to the CSS
timeline at the top of that file."""
import numpy as np, wave, sys

SR = 48000; DUR = 9.0
t = np.arange(int(SR * DUR)) / SR
L = np.zeros_like(t); R = np.zeros_like(t)
rng = np.random.default_rng(11)

def place(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); n = min(len(sig), len(t) - i)
    L[i:i+n] += sig[:n] * gain * (1 - max(pan, 0)); R[i:i+n] += sig[:n] * gain * (1 + min(pan, 0))

def env(n, a, d, curve=3.0):
    x = np.linspace(0, 1, n); e = np.ones(n); ai = int(a * n)
    e[:ai] = np.linspace(0, 1, max(ai, 1)); e[ai:] = np.exp(-curve * (x[ai:] - x[ai]) / max(d, 1e-6)); return e

def bp_noise(n, lo, hi):
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR)
    m = ((f >= lo) & (f <= hi)).astype(float); m = np.convolve(m, np.ones(64) / 64, mode="same")
    return np.fft.irfft(X * m, n)

def whoosh(dur, f0, f1, chunks=20):
    n = int(dur * SR); out = np.zeros(n); cl = n // chunks
    for k in range(chunks):
        p = k / (chunks - 1); lo = f0 + (f1 - f0) * p ** 1.5
        seg = bp_noise(cl * 2, lo, lo * 2.4) * np.hanning(cl * 2); s = k * cl; e = min(s + cl * 2, n)
        out[s:e] += seg[: e - s]
    out *= env(n, 0.3, 0.5, 4); return out / np.abs(out).max()

def tick(lo, hi, ms, g=1.0):
    n = int(ms / 1000 * SR); s = bp_noise(n, lo, hi) * env(n, 0.03, 0.4, 7); return s / np.abs(s).max() * g

def thump(f=58, dur=0.6):
    n = int(dur * SR); x = np.arange(n) / SR
    return np.sin(2 * np.pi * (f + 40 * np.exp(-x * 18)) * x) * np.exp(-x * 9)

def chime(dur=1.6):
    n = int(dur * SR); x = np.arange(n) / SR
    note = lambda f, g: (np.sin(2*np.pi*f*x) + .35*np.sin(2*np.pi*2*f*x) + .12*np.sin(2*np.pi*3*f*x)) * g
    c = (note(659.25, 1) + note(987.77, .7)) * np.exp(-x * 2.6) * env(n, .01, 1, 1); return c / np.abs(c).max()

# phone slides up
w = whoosh(0.85, 160, 2400)
for k in range(0, len(w), 2400):
    p = k / len(w); seg = w[k:k+2400]
    L[k:k+len(seg)] += seg * 0.8 * (0.6 + 0.4 * (1 - p)); R[k:k+len(seg)] += seg * 0.8 * (0.6 + 0.4 * p)
place(thump(52, 0.5), 0.75, 0.45)
place(tick(2500, 7000, 45), 0.92, 0.18); place(whoosh(0.5, 1200, 5000, 10), 1.06, 0.14, 0.2)
for i in range(10): place(tick(3000, 8000, 28), 1.2 + i * 0.11, 0.08 + 0.01 * (i % 3))
place(tick(1500, 4000, 60), 2.12, 0.09)
for i, at in enumerate([2.5, 2.7, 2.9, 3.1]): place(whoosh(0.32, 500, 3200, 8), at, 0.22, 0.25 - 0.15 * i)
for i, at in enumerate([3.6, 3.8, 4.0, 4.2]): place(tick(1800, 6000, 55), at, 0.17, -0.3 + 0.2 * i)
place(thump(60, 0.6), 4.72, 0.6); place(tick(2500, 7000, 40), 4.97, 0.12); place(tick(2000, 6000, 50), 5.32, 0.12)
place(whoosh(1.0, 3000, 7000, 14), 5.5, 0.12, 0.0)   # sheen
place(whoosh(0.6, 2600, 300, 10), 6.0, 0.3)
place(thump(56, 0.6), 6.47, 0.5); place(chime(1.8), 6.55, 0.3)
place(tick(2500, 7000, 45), 6.93, 0.14); place(tick(1800, 5000, 55), 7.1, 0.12)
bed = np.sin(2*np.pi*55*t) * 0.035 * np.clip((t - 0.5) / 0.4, 0, 1) * np.clip((8.8 - t) / 0.5, 0, 1)
L += bed; R += bed

mix = np.stack([L, R], 1); mix = mix / np.abs(mix).max() * 0.71
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "site.wav", "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", DUR)
