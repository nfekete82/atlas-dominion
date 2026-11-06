#!/usr/bin/env python3
"""Remove only the exterior dark backing of the Sandforge logo.

Keeps the original lettering, metallic relief, emblem and internal dark details.
The original WebP remains untouched; output is a new alpha-enabled lossless WebP.
Requires Pillow: python3 -m pip install Pillow
"""
from collections import deque
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/assets/reborn/sandforge-logo.webp"
OUTPUT = ROOT / "src/assets/reborn/sandforge-logo-transparent.webp"

image = Image.open(SOURCE).convert("RGBA")
rgba = np.array(image, dtype=np.uint8)
height, width = rgba.shape[:2]
pixels = rgba[:, :, :3].astype(np.int16)

# A near-black backing runs to the four corners. Remove ONLY dark areas
# connected to the outer perimeter; preserve the shield's dark steel details.
border = np.concatenate((
    pixels[:max(2, height // 25), :max(2, width // 25)].reshape(-1, 3),
    pixels[:max(2, height // 25), -max(2, width // 25):].reshape(-1, 3),
    pixels[-max(2, height // 25):, :max(2, width // 25)].reshape(-1, 3),
    pixels[-max(2, height // 25):, -max(2, width // 25):].reshape(-1, 3)
))
background = np.median(border, axis=0)
distance = np.max(np.abs(pixels - background), axis=2)
brightness = np.max(pixels, axis=2)
# The backing may have a subtle gradient. The background remains dim;
# orange/gold letters and blue-gold emblem remain above these thresholds.
dark_exterior = (distance < 57) & (brightness < 112)
seen = np.zeros((height, width), dtype=np.uint8)
queue = deque()
def add(x, y):
    if 0 <= x < width and 0 <= y < height and dark_exterior[y, x] and not seen[y, x]:
        seen[y, x] = 1
        queue.append((x, y))
for x in range(width):
    add(x, 0)
    add(x, height - 1)
for y in range(height):
    add(0, y)
    add(width - 1, y)
while queue:
    x, y = queue.popleft()
    add(x - 1, y)
    add(x + 1, y)
    add(x, y - 1)
    add(x, y + 1)

removed = seen.astype(bool)
removed_ratio = float(np.mean(removed))
if removed_ratio < 0.08:
    raise RuntimeError(f"Dark backing not detected; refusing opaque output ({removed_ratio:.1%} removed).")
if removed_ratio > 0.85:
    raise RuntimeError(f"Foreground may have been lost; refusing output ({removed_ratio:.1%} removed).")

# Soften a tiny outer contour without erasing tiny letter holes or engravings.
mask = Image.fromarray(np.where(removed, 0, 255).astype(np.uint8), "L")
mask = mask.filter(ImageFilter.GaussianBlur(0.85))
alpha = np.minimum(np.asarray(mask), rgba[:, :, 3])
rgba[:, :, 3] = alpha
rgba[0, :, 3] = 0
rgba[-1, :, 3] = 0
rgba[:, 0, 3] = 0
rgba[:, -1, 3] = 0
out = Image.fromarray(rgba, "RGBA")
out.save(OUTPUT, "WEBP", lossless=True, method=6)
saved = Image.open(OUTPUT).convert("RGBA")
edge = np.array(saved)[:, :, 3]
assert edge.min() == 0 and edge.max() == 255
assert np.all(edge[0, :] == 0) and np.all(edge[-1, :] == 0)
assert np.all(edge[:, 0] == 0) and np.all(edge[:, -1] == 0)
print(f"Sandforge alpha logo {width}x{height}: {removed_ratio:.1%} exterior removed, {OUTPUT.stat().st_size:,} bytes.")
