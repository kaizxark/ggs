#!/usr/bin/env python3
"""Regenerate the brand icons at the size they are actually displayed at.

The mark is a flat-colour emblem, but it shipped as a 512x512 truecolour PNG at
269 KB and was referenced at 35px (navbar), 52px (footer ticker) and 56px (the
footer lockup). It was the second-largest thing a visitor downloaded, behind the
background videos.

Two changes, both of which keep the rendered result the same:

- Size. 192px is the largest dimension anything needs: the biggest use is 80px
  wide on the login screen, and 192 covers that at 2x on a high-density display.
- Palette. The emblem quantises to a 256-colour palette, which keeps the median
  per-channel error at 2/255 and the worst pixel at 30/255 - both invisible at
  these sizes - while the PNG drops by more than an order of magnitude. 128
  colours saves a further 600 B but pushes the worst-case pixel to 46/255 in the
  soft gradients across the middle of the mark, which is not a trade worth
  making for 6% of the file.

It also writes favicon.ico. There was none, so /favicon.ico fell through to the
SPA rewrite and the browser downloaded the entire 368 KB index.html to display
as an icon.

Run after changing the mark:

    python3 scripts/optimise-icons.py
"""

from __future__ import annotations

import io
import struct
from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / "client" / "public"

# Largest dimension each file is rendered at, in CSS pixels, before DPR scaling.
# logo.png tops out on the login and password-reset screens at 80px.
TARGETS = {
    "logo.png": 192,
    "logo-192.png": 192,
    "logo-64.png": 64,
    "favicon-32.png": 32,
    "favicon-64.png": 64,
    "favicon-128.png": 128,
    "apple-touch-icon.png": 180,
}

PALETTE_COLOURS = 256

# iOS composites the touch icon onto an opaque tile and does not honour
# transparency, so a transparent mark would show as a black square on a
# dark home screen. White matches the site's own background.
APPLE_BACKGROUND = (255, 255, 255, 255)


def encode_png(image: Image.Image) -> bytes:
    """Quantise to a palette and re-encode."""
    buffer = io.BytesIO()
    image.quantize(colors=PALETTE_COLOURS, method=Image.FASTOCTREE).save(
        buffer, "PNG", optimize=True
    )
    return buffer.getvalue()


def ico_bytes(images: list[Image.Image]) -> bytes:
    """Pack PNGs into an .ico container."""
    payloads = [encode_png(im) for im in images]
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    directory = b""
    for image, payload in zip(images, payloads):
        # 0 in the size byte means 256; every size here is smaller.
        directory += struct.pack(
            "<BBBBHHII",
            image.size[0],
            image.size[1],
            0,  # palette colours, 0 for truecolour
            0,  # reserved
            1,  # colour planes
            32,  # bits per pixel
            len(payload),
            offset,
        )
        offset += len(payload)
    return header + directory + b"".join(payloads)


def main() -> None:
    source = PUBLIC / "logo.png"
    if not source.exists():
        raise SystemExit(f"missing {source}")

    original = Image.open(source).convert("RGBA")
    before = source.stat().st_size

    print(f"source {original.size[0]}x{original.size[1]}, {before:,} B\n")

    total_before = before
    total_after = 0

    for name, size in TARGETS.items():
        path = PUBLIC / name
        if not path.exists():
            print(f"  {name:24s} skipped (not present)")
            continue

        was = path.stat().st_size
        resized = original.resize((size, size), Image.LANCZOS)

        if name == "apple-touch-icon.png":
            tile = Image.new("RGBA", (size, size), APPLE_BACKGROUND)
            tile.alpha_composite(resized)
            resized = tile

        path.write_bytes(encode_png(resized))
        now = path.stat().st_size

        if name != "logo.png":
            total_before += was
        total_after += now
        print(f"  {name:24s} {was:8,d} -> {now:7,d} B  ({was / now:.1f}x smaller)")

    # The .ico is new, so it only adds to the "after" column.
    icon = PUBLIC / "favicon.ico"
    icon.write_bytes(
        ico_bytes([original.resize((s, s), Image.LANCZOS) for s in (32, 64, 128)])
    )
    total_after += icon.stat().st_size
    print(f"  {'favicon.ico':24s} {'missing':>8s} -> {icon.stat().st_size:7,d} B  (new)")

    print(
        f"\ntotal {total_before:,} -> {total_after:,} B "
        f"({total_before / total_after:.1f}x smaller)"
    )


if __name__ == "__main__":
    main()
