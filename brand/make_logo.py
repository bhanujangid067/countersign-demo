"""Build the Countersign logo files (SVG) from one definition of the mark and the wordmark.

The mark: a handwritten C whose last stroke becomes a tick. A signature and an approval in one line.
The wordmark: "Countersign" in IBM Plex Sans Bold, turned into outlines so it looks the same everywhere.

Usage: <python with fonttools + brotli> brand/make_logo.py
Writes brand/*.svg
"""

from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = Path(__file__).resolve().parent
# A variable font with every weight in it; WEIGHT picks the one used for the name.
FONT = HERE.parent / "video" / "remotion" / "public" / "fonts" / "IBMPlexSans-700-latin.woff2"
WEIGHT = 700

INK = "#16212c"
PEN = "#1f3d8c"
WHITE = "#ffffff"

# The mark, on a 64 x 64 grid. One stroke: the C, then the tick.
STROKE = "M42.5 18.8C36.5 14.4 25.4 15.4 20.4 23.4C16.4 29.8 17.8 38.6 24 42.6L32.4 48.6L50.6 25.2"
STROKE_WIDTH = 5.2
SHIFT = (-2.2, 0.4)  # optical centring inside the square


def mark(tile: str, line: str) -> str:
    """The mark's SVG body: a rounded square in `tile` with the stroke in `line`."""
    return (
        f'<rect width="64" height="64" rx="15" fill="{tile}"/>'
        f'<path d="{STROKE}" transform="translate({SHIFT[0]} {SHIFT[1]})" fill="none" stroke="{line}" '
        f'stroke-width="{STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>'
    )


def wordmark(text: str, size: float, tracking: float = -0.022) -> tuple[str, float]:
    """Outline path for `text` at font `size` (baseline at y=0), and its width."""
    font = TTFont(FONT)
    if "fvar" in font:
        font = instantiateVariableFont(font, {"wght": WEIGHT})
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    x, parts = 0.0, []
    for ch in text:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, 0)))
        parts.append(pen.getCommands())
        x += glyphs[name].width * scale + tracking * size
    return "".join(parts), x - tracking * size


def svg(width: float, height: float, body: str, title: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}" width="{width:g}" height="{height:g}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n')


def main() -> None:
    files = {}
    # Marks
    files["countersign-mark.svg"] = svg(64, 64, mark(PEN, WHITE), "Countersign")
    files["countersign-mark-on-dark.svg"] = svg(64, 64, mark(WHITE, PEN), "Countersign")
    files["countersign-mark-mono.svg"] = svg(64, 64, mark(INK, WHITE), "Countersign")
    files["favicon.svg"] = files["countersign-mark.svg"]

    # Horizontal lockups: mark + wordmark, the name's capitals about half the mark's height.
    size = 42.0
    word, wwidth = wordmark("Countersign", size)
    gap, baseline = 18.0, 32 + 0.698 * size / 2  # Plex cap height is 0.698 em; centre the capitals on the mark
    width, height = 64 + gap + wwidth, 64
    def lockup(tile: str, line: str, text: str) -> str:
        return mark(tile, line) + f'<path d="{word}" transform="translate({64 + gap:g} {baseline:.2f})" fill="{text}"/>'
    files["countersign-logo.svg"] = svg(width, height, lockup(PEN, WHITE, INK), "Countersign")
    files["countersign-logo-on-dark.svg"] = svg(width, height, lockup(WHITE, PEN, WHITE), "Countersign")
    files["countersign-logo-mono.svg"] = svg(width, height, lockup(INK, WHITE, INK), "Countersign")

    # Stacked: mark above the name, for square spaces (slides, social avatars).
    s_size = 28.0
    s_word, s_w = wordmark("Countersign", s_size)
    s_width = max(64, s_w) + 16
    s_height = 64 + 16 + 0.698 * s_size + 10
    stacked = (f'<g transform="translate({(s_width - 64) / 2:.2f} 0)">{mark(PEN, WHITE)}</g>'
               f'<path d="{s_word}" transform="translate({(s_width - s_w) / 2:.2f} {64 + 16 + 0.698 * s_size:.2f})" fill="{INK}"/>')
    files["countersign-logo-stacked.svg"] = svg(s_width, s_height, stacked, "Countersign")

    for name, text in files.items():
        (HERE / name).write_text(text)
        print(name)


if __name__ == "__main__":
    main()
