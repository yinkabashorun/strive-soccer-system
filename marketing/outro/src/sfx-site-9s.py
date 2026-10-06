"""Soothing sound bed for site-build-9s.html (9.0 s). Warm pad under
everything, soft mallet tones instead of clicks, dark low whooshes,
a gentle felt-piano style chime at the end, and a short room tail on
every cue so nothing lands dry. Peaks kept around -6 dBFS."""
import numpy as np, wave, sys

SR = 48000; DUR = 9.0
t = np.arange(int(SR * DUR)) / SR
L = np.zeros_like(t); R = np.zeros_like(t)
rng = np.random.default_rng(23)

def place(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); n = min(len(sig), len(t) - i)
    L[i:i+n] += sig[:n] * gain * (1 - max(pan, 0)); R[i:i+n] += sig[:n] * gain * (1 + min(pan, 0))

def lowpass(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = 1 / (1 + (f / cutoff) ** 4); return np.fft.irfft(X * m, len(x))

def bp_noise(n, lo, hi):
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR)
    m = ((f >= lo) & (f <= hi)).astype(float); m = np.convolve(m, np.ones(256) / 256, mode="same")
    return np.fft.irfft(X * m, n)

def room(x, decay=0.35, mix=0.28):
    """Tiny plate: convolve with a short exponentially decaying noise burst."""
    n = int(decay * SR); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (decay * SR / 4)); ir = lowpass(ir, 5000); ir /= np.abs(ir).sum() / 6
    wet = np.convolve(x, ir)[: len(x)]
    return x * (1 - mix) + wet * mix

def env_ad(n, attack, release, curve=3.0):
    x = np.linspace(0, 1, n); e = np.ones(n); a = int(attack * SR)
    e[:a] = np.sin(np.linspace(0, np.pi / 2, max(a, 1))) ** 2
    rel = np.exp(-curve * np.arange(n - a) / max(release * SR, 1)); e[a:] = rel; return e

def mallet(f, dur=0.9, attack=0.012, bright=0.25):
    """Soft marimba-ish tone: fundamental + quiet 4th partial, quick soft attack, long decay."""
    n = int(dur * SR); x = np.arange(n) / SR
    s = np.sin(2*np.pi*f*x) + bright * np.sin(2*np.pi*f*4.0*x) * np.exp(-x * 14) + 0.12 * np.sin(2*np.pi*f*2*x)
    s *= env_ad(n, attack, dur * 0.45, 3.5); return room(s / np.abs(s).max(), 0.3, 0.3)

def soft_whoosh(dur, f0, f1, chunks=20):
    n = int(dur * SR); out = np.zeros(n); cl = n // chunks
    for k in range(chunks):
        p = k / (chunks - 1); lo = f0 + (f1 - f0) * p ** 1.4
        seg = bp_noise(cl * 2, lo, lo * 2.2) * np.hanning(cl * 2); s = k * cl; e = min(s + cl * 2, n)
        out[s:e] += seg[: e - s]
    out *= env_ad(n, dur * 0.4, dur * 0.45, 3.0); out = lowpass(out, 2600)
    return out / np.abs(out).max()

def thump(f=50, dur=0.9):
    n = int(dur * SR); x = np.arange(n) / SR
    s = np.sin(2 * np.pi * (f + 22 * np.exp(-x * 12)) * x) * np.exp(-x * 6) * env_ad(n, 0.01, 0.5)
    return lowpass(s, 180)

def felt_chime(dur=2.6):
    """Two soft notes (E5 + B5) with slow bloom, like a felt piano."""
    n = int(dur * SR); x = np.arange(n) / SR
    def note(f, g, d=0):
        e = env_ad(n, 0.05, dur * 0.5, 2.6); s = (np.sin(2*np.pi*f*x) + 0.25*np.sin(2*np.pi*2*f*x) + 0.06*np.sin(2*np.pi*3*f*x)) * e * g
        return np.roll(s, int(d * SR)) if d else s
    c = note(659.25, 1.0) + note(987.77, 0.6, 0.09) + note(329.63, 0.35)
    c = lowpass(c, 4200); return room(c / np.abs(c).max(), 0.5, 0.35)

# --- warm pad under everything: Em9 voicing, slow swell in, slow fade out ---
pad = np.zeros_like(t)
for f, g in [(82.41, 1.0), (123.47, 0.6), (164.81, 0.5), (246.94, 0.35), (369.99, 0.18)]:
    det = 1 + 0.0012 * rng.standard_normal()
    pad += np.sin(2*np.pi*f*det*t + 0.3*np.sin(2*np.pi*0.2*t)) * g
    pad += np.sin(2*np.pi*f*(2 - det)*t) * g * 0.5
pad = lowpass(pad, 900) / np.abs(pad).max()
pad *= np.clip((t - 0.2) / 1.6, 0, 1) ** 2 * np.clip((8.9 - t) / 1.2, 0, 1)
L += pad * 0.16; R += pad * 0.16

# --- cues, timed to the CSS timeline in site-build-9s.html ---
# phone rises (dark whoosh, panned a touch left to right) and settles (soft thump)
w = soft_whoosh(0.9, 90, 900)
for k in range(0, len(w), 2400):
    p = k / len(w); seg = w[k:k+2400]
    L[k:k+len(seg)] += seg * 0.42 * (0.7 + 0.3 * (1 - p)); R[k:k+len(seg)] += seg * 0.42 * (0.7 + 0.3 * p)
place(thump(48, 0.9), 0.78, 0.5)
# wordmark + hairline: a low mallet, then a soft air sweep
place(mallet(329.63, 1.1), 0.92, 0.22); place(soft_whoosh(0.55, 500, 1800, 10), 1.06, 0.10, 0.2)
# headline: rising mallet arpeggio, one tone every other word, very quiet
arp = [392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 587.33, 659.25, 739.99, 783.99]
for i, f in enumerate(arp): place(mallet(f, 0.7, 0.01, 0.15), 1.2 + i * 0.11, 0.075, -0.25 + 0.05 * i)
# cards slide in: soft dark whooshes, each a little to the right
for i, at in enumerate([2.5, 2.7, 2.9, 3.1]): place(soft_whoosh(0.38, 220, 1300, 8), at, 0.16, 0.25 - 0.15 * i)
# drill tiles: four mallet notes, a gentle chord spelled out
for i, (at, f) in enumerate(zip([3.6, 3.8, 4.0, 4.2], [523.25, 659.25, 783.99, 987.77])): place(mallet(f, 0.9), at, 0.13, -0.3 + 0.2 * i)
# CTA block: warm thump, rule + button as two low mallets
place(thump(55, 1.0), 4.72, 0.5); place(mallet(392.0, 1.0), 4.97, 0.12); place(mallet(493.88, 1.0), 5.32, 0.12)
# sheen: a long, airy, very quiet sweep
place(soft_whoosh(1.1, 900, 2400, 16), 5.5, 0.09)
# phone recedes: downward dark whoosh
place(soft_whoosh(0.7, 1200, 120, 10), 6.0, 0.22)
# end card: soft low thump, felt chime, two closing mallets
place(thump(52, 1.0), 6.47, 0.42); place(felt_chime(), 6.55, 0.34)
place(mallet(659.25, 1.4), 6.93, 0.12); place(mallet(493.88, 1.6), 7.1, 0.10)

mix = np.stack([L, R], 1)
mix = lowpass(mix[:, 0], 9000), lowpass(mix[:, 1], 9000)
mix = np.stack(mix, 1); mix = mix / np.abs(mix).max() * 0.5   # ~ -6 dBFS peak
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "site-9s.wav", "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", DUR)
