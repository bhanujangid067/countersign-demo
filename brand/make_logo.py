"""Build the Countersign logo files (SVG).

The mark: {✓}, curly braces around a tick. A block of code that has been approved.
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
BRACE_FONT = FONTS / "IBMPlexMono-700-latin.woff2"
NAME_FONT = FONTS / "IBMPlexMono-600-latin.woff2"

# Colours: a dark code editor with syntax colours (grey punctuation, green "passed" tick).
EDITOR = "#0e151d"
INK = "#16212c"
BRACE_ON_DARK = "#8b97a2"
TICK_ON_DARK = "#5fd39a"
BRACE_ON_LIGHT = "#8b97a2"
TICK_ON_LIGHT = "#17734a"
WHITE = "#ffffff"

# The tick, on the same 64 x 64 grid as the mark, centred between the braces.
TICK = "M25.2 32.6L29.8 37.2L38.8 27.6"
TICK_WIDTH = 4.4


def glyph(font: TTFont, char: str, size: float, x: float, baseline: float) -> tuple[str, tuple[float, float, float, float]]:
    """Outline of one character at `size`, with its origin at x and baseline at `baseline`, plus its bounds."""
    glyphs = font.getGlyphSet()
    name = font.getBestCmap()[ord(char)]
    s = size / font["head"].unitsPerEm
    pen = SVGPathPen(glyphs)
    glyphs[name].draw(TransformPen(pen, (s, 0, 0, -s, x, baseline)))
    bounds = BoundsPen(glyphs)
    glyphs[name].draw(TransformPen(bounds, (s, 0, 0, -s, x, baseline)))
    return pen.getCommands(), bounds.bounds


def braces() -> tuple[str, str]:
    """Paths for { and }, sized and placed on the 64 x 64 grid."""
    font = TTFont(BRACE_FONT)
    size = 36.0
    # Measure first, then place: braces centred vertically, 9 units in from each side.
    _, (x0, y0, _, y1) = glyph(font, "{", size, 0, 0)
    baseline = 32 - (y0 + y1) / 2
    left, _ = glyph(font, "{", size, 9 - x0, baseline)
    _, (_, _, rx1, _) = glyph(font, "}", size, 0, 0)
    right, _ = glyph(font, "}", size, 55 - rx1, baseline)
    return left, right


def symbol(brace: str, tick: str) -> str:
    """{✓} without a background."""
    left, right = braces()
    return (f'<path d="{left}" fill="{brace}"/><path d="{right}" fill="{brace}"/>'
            f'<path d="{TICK}" fill="none" stroke="{tick}" stroke-width="{TICK_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>')


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
    dark_mark = tile(EDITOR) + symbol(BRACE_ON_DARK, TICK_ON_DARK)
    light_mark = tile(WHITE, "#e0e3da") + symbol(BRACE_ON_LIGHT, TICK_ON_LIGHT)
    files = {
        "countersign-mark.svg": svg(64, 64, dark_mark),
        "countersign-mark-light.svg": svg(64, 64, light_mark),
        "countersign-symbol.svg": svg(64, 64, symbol(BRACE_ON_LIGHT, TICK_ON_LIGHT)),
        "countersign-symbol-on-dark.svg": svg(64, 64, symbol(BRACE_ON_DARK, TICK_ON_DARK)),
        "countersign-symbol-mono.svg": svg(64, 64, symbol(INK, INK)),
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
    files["countersign-logo-on-dark.svg"] = svg(total, 64, tile("#1a2430") + symbol(BRACE_ON_DARK, TICK_ON_DARK) + f'<path d="{word}" {place} fill="{WHITE}"/>')
    files["countersign-logo-mono.svg"] = svg(total, 64, symbol(INK, INK) + f'<path d="{word}" {place} fill="{INK}"/>')

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
