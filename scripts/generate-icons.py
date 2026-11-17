#!/usr/bin/env python3
"""
Run: python3 scripts/generate-icons.py   (requires Pillow)
Draws at 8x and downsamples for smooth edges.
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "resources" / "icons"
GREEN = (31, 175, 110, 255)
WHITE = (255, 255, 255, 255)
RED = (229, 57, 53, 255)
SS = 8

def bubble(draw: ImageDraw.ImageDraw, s: int, box: tuple[float, float, float, float], fill, dots) -> None:
    x0, y0, x1, y1 = (v * s for v in box)
    r = (y1 - y0) * 0.38
    draw.rounded_rectangle((x0, y0, x1, y1), radius=r, fill=fill)
    draw.polygon([(x0 + r * 0.6, y1 - r * 0.5), (x0 + r * 0.2, y1 + (y1 - y0) * 0.28), (x0 + r * 1.6, y1 - 1)], fill=fill)
    cy = (y0 + y1) / 2
    dr = (y1 - y0) * 0.09
    for i in (-1, 0, 1):
        cx = (x0 + x1) / 2 + i * (x1 - x0) * 0.22
        draw.ellipse((cx - dr, cy - dr, cx + dr, cy + dr), fill=dots)

def render(size: int, kind: str) -> Image.Image:
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == "app":
        d.rounded_rectangle((0.06 * s, 0.06 * s, 0.94 * s, 0.94 * s), radius=0.22 * s, fill=GREEN)
        bubble(d, s, (0.22, 0.26, 0.78, 0.66), WHITE, GREEN)
    else:  # tray
        d.ellipse((0.02 * s, 0.02 * s, 0.98 * s, 0.98 * s), fill=GREEN)
        bubble(d, s, (0.2, 0.25, 0.8, 0.65), WHITE, GREEN)
        if kind == "tray-unread":
            d.ellipse((0.58 * s, 0.0, 1.0 * s, 0.42 * s), fill=RED, outline=(0, 0, 0, 0))
    return img.resize((size, size), Image.Resampling.LANCZOS)

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (512, 256, 128, 64, 48, 32):
        render(size, "app").save(OUT / f"{size}x{size}.png")
    render(64, "tray").save(OUT / "tray.png")
    render(64, "tray-unread").save(OUT / "tray-unread.png")
    print("icons written to", OUT)

if __name__ == "__main__":
    main()
