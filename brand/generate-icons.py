#!/usr/bin/env python3
"""Regenerate the Venapce icon set from the two source owls.

The owl is a flat single-colour glyph and both sources share a byte-identical
alpha channel, so everything here is one shape tinted differently:

  public/favicon-{light,dark}-32.png  transparent glyph, one per colour scheme
  public/favicon.ico                  navy fallback for browsers ignoring `media`
  public/apple-touch-icon.png         opaque tile — iOS ignores transparency
  public/icon-{192,512}.png           Android / PWA manifest icons
  src/assets/owl-mark.png             mask source for BrandMark.vue (alpha only)

Run from the repo root:  python3 brand/generate-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
NAVY = (33, 77, 112, 255)   # sampled from brand/owl-venapce.png
PALE = (246, 247, 248, 255)  # sampled from brand/owl-white.png

glyph = Image.open(ROOT / 'brand/owl-white.png').convert('RGBA').split()[3]
glyph = glyph.crop(glyph.getbbox())  # padding is ours to control, not the file's


def tinted(size: int, colour: tuple, pad_ratio: float = 0.06) -> Image.Image:
    """Transparent square canvas with the owl centred, drawn in `colour`."""
    box = int(size * (1 - 2 * pad_ratio))
    w, h = glyph.size
    scale = min(box / w, box / h)
    g = glyph.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(Image.new('RGBA', g.size, colour), ((size - g.size[0]) // 2, (size - g.size[1]) // 2), g)
    return canvas


def tile(size: int, radius_ratio: float = 0.22) -> Image.Image:
    """Opaque navy rounded tile with the pale owl on it."""
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(bg).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=NAVY)
    return Image.alpha_composite(bg, tinted(size, PALE, pad_ratio=0.17))


pub = ROOT / 'public'
for name, colour in [('favicon-light', NAVY), ('favicon-dark', PALE)]:
    tinted(32, colour).save(pub / f'{name}-32.png')
    tinted(180, colour).save(pub / f'{name}.png')

tinted(256, NAVY).save(pub / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
tile(180).save(pub / 'apple-touch-icon.png')
tile(192).save(pub / 'icon-192.png')
tile(512).save(pub / 'icon-512.png')
# Mask source: tight-cropped at the glyph's native aspect, so BrandMark.vue can
# give the element that same aspect-ratio and the box hugs the artwork exactly.
mark = Image.new('RGBA', glyph.size, PALE)
mark.putalpha(glyph)
mark.resize((round(512 * glyph.size[0] / glyph.size[1]), 512), Image.LANCZOS).save(
    ROOT / 'src/assets/owl-mark.png'
)
print('mask aspect:', glyph.size[0], '/', glyph.size[1])

print('icons regenerated')
