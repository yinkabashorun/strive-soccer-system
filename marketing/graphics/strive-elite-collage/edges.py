"""Edge clean-up for player cutouts: smooth jagged alpha, drop the 1 px fringe,
and pull edge colours from the player's own interior so no dark or green halo
from the original background shows on the poster.

usage: python3 edges.py in.png out.png
"""
import sys
import cv2
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
m = np.array(Image.open(src).convert("RGBA"))
rgb = m[..., :3].astype(np.float32)
a = m[..., 3].astype(np.float32)

# 1. alpha: kill stray specks, close pin-holes, smooth the stair-steps
solid = (a > 127).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
keep = np.zeros_like(solid)
for i in range(1, n):
    if st[i, 4] > 400:
        keep[lab == i] = 1
solid = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
solid = cv2.morphologyEx(solid, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
# keep soft alpha the source already had where it was intentionally faded (bottom fades)
soft_src = (a > 3) & (a < 250)
smooth = cv2.GaussianBlur(solid.astype(np.float32), (0, 0), 1.1)
smooth = np.clip((smooth - 0.5) * 2.2 + 0.5, 0, 1)  # crisp but anti-aliased
# 1 px choke so the background fringe goes
choked = cv2.erode(smooth, np.ones((2, 2), np.uint8))
alpha = choked * 255.0
# respect deliberate fades: never raise alpha above the source where the source was a fade band
fadeband = soft_src & (cv2.erode((a > 250).astype(np.uint8), np.ones((5, 5), np.uint8)) == 0)
# bottom-fade rows (wide soft bands) keep the source alpha
wide = fadeband.sum(1) > 0.4 * (a > 3).sum(1).clip(1)
alpha[wide] = np.minimum(alpha[wide], a[wide])

# 2. colour decontamination: edge band takes the colour of the nearest interior pixel
interior = cv2.erode((alpha > 250).astype(np.uint8), np.ones((5, 5), np.uint8))
dist, labels = cv2.distanceTransformWithLabels(1 - interior, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
ys, xs = np.where(interior == 1)
lut = np.zeros((labels.max() + 1, 3), np.float32)
lut[labels[ys, xs]] = rgb[ys, xs]
nearest = lut[labels]
band = (alpha > 0) & (interior == 0)
w = np.clip(dist / 4.0, 0, 1)[..., None] * band[..., None]
out_rgb = rgb * (1 - 0.75 * w) + nearest * (0.75 * w)

out = np.dstack([np.clip(out_rgb, 0, 255), np.clip(alpha, 0, 255)]).astype(np.uint8)
Image.fromarray(out).save(dst)
print(dst, "ok")
