"""Build the Countersign logo files (SVG).

The mark: $_ , a terminal prompt waiting for the next command. $ is what a shell shows,
and it hints at money: Countersign sits in the pipeline, in front of code that moves money.
The name: "countersign" in IBM Plex Mono SemiBold, lowercase, like code.
Letters are turned into outlines, so the logo looks the same everywhere, even without the font.

Usage: <python with fonttools + brotli> brand/make_logo.py
Writes brand/*.svg
"""

from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
FONTS = HERE.parent / "video" / "remotion" / "public" / "fonts"
MARK_FONT = FONTS / "IBMPlexMono-700-latin.woff2"
NAME_FONT = FONTS / "IBMPlexMono-600-latin.woff2"

# Colours: a dark terminal with a green cursor.
TERMINAL = "#0e151d"
INK = "#16212c"
WHITE = "#ffffff"
CURSOR_ON_DARK = "#5fd39a"
CURSOR_ON_LIGHT = "#17734a"

# The $ and the cursor on a 64 x 64 grid.
DOLLAR_SIZE = 40.0
CURSOR_W, CURSOR_H, CURSOR_GAP = 14.0, 5.2, 2.6


def outline(font: TTFont, char: str, size: float, x: float, baseline: float) -> tuple[str, tuple[float, float, float, float]]:
    """One character's outline at `size` (origin x, baseline y) and its bounds."""
    glyphs = font.getGlyphSet()
    name = font.getBestCmap()[ord(char)]
    s = size / font["head"].unitsPerEm
    pen, bounds = SVGPathPen(glyphs), BoundsPen(glyphs)
    glyphs[name].draw(TransformPen(pen, (s, 0, 0, -s, x, baseline)))
    glyphs[name].draw(TransformPen(bounds, (s, 0, 0, -s, x, baseline)))
    return pen.getCommands(), bounds.bounds


def prompt(dollar: str, cursor: str) -> str:
    """$_ without a background, centred on the 64 x 64 grid."""
    font = TTFont(MARK_FONT)
    _, (x0, y0, x1, y1) = outline(font, "$", DOLLAR_SIZE, 0, 0)  # y is negative above the baseline
    width = (x1 - x0) + CURSOR_GAP + CURSOR_W
    left = (64 - width) / 2
    baseline = 32 - (y0 + y1) / 2 + 1.0  # centre the $ vertically, nudged down a touch for the cursor's weight
    path, (_, _, dx1, _) = outline(font, "$", DOLLAR_SIZE, left - x0, baseline)
    cx = dx1 + CURSOR_GAP
    return (f'<path d="{path}" fill="{dollar}"/>'
            f'<rect x="{cx:.2f}" y="{baseline - CURSOR_H:.2f}" width="{CURSOR_W}" height="{CURSOR_H}" rx="1.4" fill="{cursor}"/>')


def tile(fill: str, stroke: str | None = None) -> str:
    edge = f' stroke="{stroke}" stroke-width="1.5"' if stroke else ""
    inset = 0.75 if stroke else 0
    return f'<rect x="{inset}" y="{inset}" width="{64 - 2 * inset}" height="{64 - 2 * inset}" rx="15"{edge} fill="{fill}"/>'


def name(size: float) -> tuple[str, float]:
    """Outline of "countersign" (baseline at y=0) and its width."""
    font = TTFont(NAME_FONT)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    s = size / font["head"].unitsPerEm
    x, parts = 0.0, []
    for ch in "countersign":
        pen = SVGPathPen(glyphs)
        glyphs[cmap[ord(ch)]].draw(TransformPen(pen, (s, 0, 0, -s, x, 0)))
        parts.append(pen.getCommands())
        x += glyphs[cmap[ord(ch)]].width * s - 0.02 * size  # slightly tighter than code spacing
    return "".join(parts), x + 0.02 * size


def svg(width: float, height: float, body: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}" width="{width:g}" height="{height:g}" '
            f'role="img" aria-label="Countersign"><title>Countersign</title>{body}</svg>\n')


def main() -> None:
    dark_mark = tile(TERMINAL) + prompt(WHITE, CURSOR_ON_DARK)
    light_mark = tile(WHITE, "#e0e3da") + prompt(INK, CURSOR_ON_LIGHT)
    files = {
        "countersign-mark.svg": svg(64, 64, dark_mark),
        "countersign-mark-light.svg": svg(64, 64, light_mark),
        "countersign-symbol.svg": svg(64, 64, prompt(INK, CURSOR_ON_LIGHT)),
        "countersign-symbol-on-dark.svg": svg(64, 64, prompt(WHITE, CURSOR_ON_DARK)),
        "countersign-symbol-mono.svg": svg(64, 64, prompt(INK, INK)),
    }
    files["favicon.svg"] = files["countersign-mark.svg"]

    # Side by side: the name's lowercase letters centred on the mark.
    size = 34.0
    word, width = name(size)
    xh = 0.516 * size  # Plex Mono x-height
    gap, baseline = 16.0, 32 + xh / 2
    total = 64 + gap + width
    place = f'transform="translate({64 + gap:g} {baseline:.2f})"'
    files["countersign-logo.svg"] = svg(total, 64, dark_mark + f'<path d="{word}" {place} fill="{INK}"/>')
    files["countersign-logo-on-dark.svg"] = svg(total, 64, tile("#1a2430") + prompt(WHITE, CURSOR_ON_DARK) + f'<path d="{word}" {place} fill="{WHITE}"/>')
    files["countersign-logo-mono.svg"] = svg(total, 64, prompt(INK, INK) + f'<path d="{word}" {place} fill="{INK}"/>')

    # Stacked, for square spaces.
    s_size = 26.0
    s_word, s_w = name(s_size)
    s_width = max(64.0, s_w) + 16
    s_height = 64 + 14 + 0.73 * s_size + 8
    files["countersign-logo-stacked.svg"] = svg(s_width, s_height,
        f'<g transform="translate({(s_width - 64) / 2:.2f} 0)">{dark_mark}</g>'
        f'<path d="{s_word}" transform="translate({(s_width - s_w) / 2:.2f} {64 + 14 + 0.516 * s_size + 4:.2f})" fill="{INK}"/>')

    for old in HERE.glob("*.svg"):
        if old.name not in files:
            old.unlink()
    for fname, text in files.items():
        (HERE / fname).write_text(text)
        print(fname)


if __name__ == "__main__":
    main()
