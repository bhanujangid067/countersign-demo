"""Build the Countersign logo files (SVG) from the final logo image.

The mark: two halves of an S that lock together, with a spark where they meet.
Two people, two signatures: the change only goes through when both halves meet.

The source is brand/source/countersign-logo-original.png. Each shape is traced into a smooth
vector outline with potrace, so the logo stays sharp at any size.

Usage: brew install potrace; <python with pillow, numpy, scipy> brand/make_logo.py
Writes brand/*.svg and brand/parts.json (the traced shapes, used by the video).
"""

import json
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "source" / "countersign-logo-original.png"
UP = 4  # trace at 4x the image size, for smoother curves

INK = "#1a1a1a"
SPARK = "#f27236"
IVORY = "#eae6de"
PAPER = "#f9f8f6"
NIGHT = "#141414"

# The spark is drawn by hand (in source pixels) rather than traced: it is small, and a clean
# geometric star looks better than a trace of its soft edges. Straight on the left, long point to the right.
SPARK_PATH = "M635 547Q645 577 671 583Q645 589 635 619Q635.5 592 628 583Q635.5 574 635 547Z"


def trace(mask: np.ndarray, x0: int, y0: int) -> str:
    """Trace a 0/1 mask (cropped at x0, y0 in the source image) into one SVG path in source pixels."""
    h, w = mask.shape
    big = Image.fromarray((mask * 255).astype(np.uint8)).resize((w * UP, h * UP), Image.LANCZOS)
    bits = (np.asarray(big) > 127)
    with tempfile.TemporaryDirectory() as tmp:
        pbm, out = Path(tmp) / "m.pbm", Path(tmp) / "m.svg"
        Image.fromarray(~bits).convert("1").save(pbm)  # potrace traces black pixels
        subprocess.run(["potrace", str(pbm), "-b", "svg", "-u", "1", "-t", "8", "-a", "1.0", "-O", "0.4", "--flat", "-o", str(out)], check=True)
        svg = out.read_text()
    d = " ".join(re.findall(r'\bd="([^"]+)"', svg))
    height = h * UP
    # potrace draws upside down (y up). Turn its path into source pixels: x = x0 + X/UP, y = y0 + (height - Y)/UP.
    tokens = re.findall(r"[MmCcLlZz]|-?\d+(?:\.\d+)?", d)
    out_d, cmd, nums = [], None, []

    def flush():
        if cmd is None:
            return
        pts = []
        for i in range(0, len(nums), 2):
            X, Y = nums[i], nums[i + 1]
            if cmd == "M":
                pts += [x0 + X / UP, y0 + (height - Y) / UP]
            else:  # relative: only scale and flip
                pts += [X / UP, -Y / UP]
        out_d.append(cmd + " ".join(f"{v:.2f}" for v in pts))

    for t in tokens:
        if t in "MmCcLl":
            flush()
            cmd, nums = t, []
        elif t in "Zz":
            flush()
            out_d.append("z")
            cmd, nums = None, []
        else:
            nums.append(float(t))
    flush()
    return "".join(out_d)


def parts() -> dict:
    a = np.asarray(Image.open(SOURCE).convert("RGB")).astype(int)
    r, b = a[..., 0], a[..., 2]
    # How much "ink" each pixel has (0 = paper, 1 = black), keeping the soft edges for smooth tracing.
    ink = np.clip((745 - a.sum(2)) / (745 - 78), 0, 1)
    spark = np.clip((r - b - 20) / 150, 0, 1)
    ink = np.clip(ink - spark, 0, 1)
    labels, _ = ndimage.label(ink > 0.5)
    boxes = ndimage.find_objects(labels)
    sizes = [(labels[s] == i + 1).sum() for i, s in enumerate(boxes)]
    big = sorted(range(len(boxes)), key=lambda i: -sizes[i])[:2]  # the two halves of the S
    top, bottom = sorted(big, key=lambda i: boxes[i][0].start)

    def crop(mask, sl, pad=6):
        y0, y1 = max(sl[0].start - pad, 0), sl[0].stop + pad
        x0, x1 = max(sl[1].start - pad, 0), sl[1].stop + pad
        return trace(mask[y0:y1, x0:x1], x0, y0)

    def only(i):
        grown = ndimage.binary_dilation(labels == i + 1, iterations=3)
        return ink * grown

    mark_bottom = max(boxes[top][0].stop, boxes[bottom][0].stop)
    word = ink.copy()
    word[: mark_bottom + 10] = 0
    wy, wx = np.nonzero(word > 0.5)
    word_box = (slice(wy.min(), wy.max() + 1), slice(wx.min(), wx.max() + 1))
    return {
        "top": crop(only(top), boxes[top]),
        "bottom": crop(only(bottom), boxes[bottom]),
        "spark": SPARK_PATH,
        "word": crop(word, word_box),
        # Bounds in source pixels: x, y, width, height.
        "mark_box": [int(boxes[top][1].start), int(boxes[top][0].start),
                     int(boxes[bottom][1].stop - boxes[top][1].start), int(mark_bottom - boxes[top][0].start)],
        "word_box": [int(wx.min()), int(wy.min()), int(wx.max() - wx.min() + 1), int(wy.max() - wy.min() + 1)],
    }


def svg(view: tuple[float, float, float, float], body: str, scale: float = 1.0) -> str:
    x, y, w, h = view
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:.1f} {y:.1f} {w:.1f} {h:.1f}" '
            f'width="{w * scale:.0f}" height="{h * scale:.0f}" role="img" aria-label="Countersign"><title>Countersign</title>{body}</svg>\n')


def main() -> None:
    p = parts()
    (HERE / "parts.json").write_text(json.dumps(p, indent=1))
    mx, my, mw, mh = p["mark_box"]
    wx, wy, ww, wh = p["word_box"]

    def mark(ink: str, spark: str = SPARK) -> str:
        return f'<path d="{p["top"]}" fill="{ink}"/><path d="{p["bottom"]}" fill="{ink}"/><path d="{p["spark"]}" fill="{spark}"/>'

    def word(ink: str, dx: float = 0, dy: float = 0, s: float = 1) -> str:
        if dx == dy == 0 and s == 1:
            return f'<path d="{p["word"]}" fill="{ink}"/>'
        # Move the word (scaled by s around its top-left corner) so its top-left lands at (dx, dy).
        return f'<path d="{p["word"]}" fill="{ink}" transform="translate({dx:.2f} {dy:.2f}) scale({s}) translate({-wx} {-wy})"/>'

    def tile(fill: str) -> tuple[tuple[float, float, float, float], str]:
        side = mh * 1.32
        x, y = mx + mw / 2 - side / 2, my + mh / 2 - side / 2
        return (x, y, side, side), f'<rect x="{x:.1f}" y="{y:.1f}" width="{side:.1f}" height="{side:.1f}" rx="{side * 0.22:.1f}" fill="{fill}"/>'

    pad = 0.12 * mh
    mark_view = (mx - (mh - mw) / 2 - pad, my - pad, mh + 2 * pad, mh + 2 * pad)
    tview, ttile = tile(NIGHT)
    lview, ltile = tile(IVORY)
    # Stacked: the original layout.
    top, bottom = my, wy + wh
    left, right = min(mx, wx), max(mx + mw, wx + ww)
    sp = 0.14 * (bottom - top)
    stacked = (left - sp, top - sp, right - left + 2 * sp, bottom - top + 2 * sp)
    # Side by side: the word, scaled so its height is 30% of the mark, centred on the mark.
    s = 0.30 * mh / wh
    gx = mx + mw + 0.22 * mh
    gy = my + mh / 2 - wh * s / 2
    wide = (mx - 0.1 * mh, my - 0.1 * mh, gx + ww * s - mx + 0.2 * mh, mh * 1.2)

    files = {
        "countersign-logo-stacked.svg": svg(stacked, mark(INK) + word(INK)),
        "countersign-logo-stacked-on-dark.svg": svg(stacked, f'<rect x="{stacked[0]}" y="{stacked[1]}" width="{stacked[2]}" height="{stacked[3]}" fill="{NIGHT}"/>' + mark(IVORY) + word(IVORY)),
        "countersign-logo.svg": svg(wide, mark(INK) + word(INK, gx, gy, s)),
        "countersign-logo-on-dark.svg": svg(wide, mark(IVORY) + word(IVORY, gx, gy, s)),
        "countersign-logo-mono.svg": svg(wide, mark(INK, INK) + word(INK, gx, gy, s)),
        "countersign-symbol.svg": svg(mark_view, mark(INK)),
        "countersign-symbol-on-dark.svg": svg(mark_view, mark(IVORY)),
        "countersign-mark.svg": svg(tview, ttile + mark(IVORY)),
        "countersign-mark-light.svg": svg(lview, ltile + mark(INK)),
        "countersign-wordmark.svg": svg((wx - 8, wy - 8, ww + 16, wh + 16), word(INK)),
    }
    files["favicon.svg"] = files["countersign-mark.svg"]
    for old in HERE.glob("*.svg"):
        if old.name not in files:
            old.unlink()
    for name, text in files.items():
        (HERE / name).write_text(text)
        print(name)


if __name__ == "__main__":
    main()
