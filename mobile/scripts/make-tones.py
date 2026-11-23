"""The set timer's four tones as tiny WAV files for the native app.

The same tones the website makes on the phone itself (lib/elite/sound.ts):
a sine with a 15 ms attack and an exponential fall, at the same pitches,
lengths and volumes. Run from mobile/: python3 scripts/make-tones.py
"""
import math
import struct
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds"

# (frequency Hz, start s, length s, volume) per tone, as in sound.ts cue()
CUES = {
    "tick": [(660, 0.0, 0.09, 0.18)],
    "go": [(990, 0.0, 0.32, 0.3)],
    "rest": [(520, 0.0, 0.3, 0.26)],
    "done": [(784, 0.0, 0.16, 0.28), (1047, 0.17, 0.34, 0.3)],
}


def render(tones):
    total = max(start + length for _, start, length, _ in tones) + 0.03
    samples = [0.0] * int(total * RATE)
    for freq, start, length, volume in tones:
        s0 = int(start * RATE)
        for i in range(int((length + 0.02) * RATE)):
            t = i / RATE
            if t < 0.015:
                env = 0.0001 * (volume / 0.0001) ** (t / 0.015)
            else:
                k = min(1.0, (t - 0.015) / max(0.001, length - 0.015))
                env = volume * (0.0001 / volume) ** k
            j = s0 + i
            if j < len(samples):
                samples[j] += env * math.sin(2 * math.pi * freq * t)
    return samples


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, tones in CUES.items():
        data = render(tones)
        with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v)) * 32767)) for v in data))
        print(name, len(data) / RATE, "s")


if __name__ == "__main__":
    main()
