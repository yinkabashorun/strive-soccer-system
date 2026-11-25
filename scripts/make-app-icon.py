# The iPhone app icon: the Strive logo (public/strive-logo-512.png) with its
# edges made crisp, on a white coin on black, the WHOLE logo inside the coin
# (the first icon was the 512 px logo enlarged: soft, and the R of SOCCER ran
# off the coin). Nothing of the logo is redrawn.
#   python3 scripts/make-app-icon.py public/strive-logo-512.png mobile/assets/icon.png 0.455 0.955
import sys
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
src, out_path, coin, fill = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
logo = Image.open(src).convert("RGBA")
bg = Image.new("RGBA", logo.size, (255, 255, 255, 255)); bg.alpha_composite(logo)
N = 4096
big = bg.convert("L").resize((N, N), Image.LANCZOS).filter(ImageFilter.GaussianBlur(3.0))
soft = 255 / (1 + np.exp(-0.09 * (np.asarray(big).astype(np.float32) - 128)))
ys, xs = np.nonzero(soft < 128)
rng = np.random.default_rng(1); idx = rng.choice(len(xs), size=min(len(xs), 200000), replace=False)
px, py = xs[idx].astype(np.float64), ys[idx].astype(np.float64)
cx, cy = (px.min() + px.max()) / 2, (py.min() + py.max()) / 2
step = 0.5
for it in range(4000):
    d = np.hypot(px - cx, py - cy); i = d.argmax()
    cx += (px[i] - cx) * step * 0.02; cy += (py[i] - cy) * step * 0.02
    if it % 500 == 499: step *= 0.6
rad = np.hypot(xs - cx, ys - cy).max()
I = 4096; R = I * coin; scale = (R * fill) / rad
art = Image.fromarray(soft.clip(0, 255).astype(np.uint8)); w = int(round(N * scale)); art = art.resize((w, w), Image.LANCZOS)
icon = Image.new("L", (I, I), 0)
ImageDraw.Draw(icon).ellipse((I / 2 - R, I / 2 - R, I / 2 + R, I / 2 + R), fill=255)
icon.paste(0, (int(round(I / 2 - cx * scale)), int(round(I / 2 - cy * scale))), Image.eval(art, lambda v: 255 - v))
icon.resize((1024, 1024), Image.LANCZOS).convert("RGB").save(out_path)
