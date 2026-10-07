"""Inline the MapLibre stylesheet into the page template and write index.html.

The published page may only load stylesheets from Google Fonts, so the
MapLibre CSS has to be inlined.

Usage:
    python assemble.py <index.template.html> <maplibre-gl.css> <out/index.html>
"""

import sys
from pathlib import Path

template, css, out = (Path(arg) for arg in sys.argv[1:4])
html = template.read_text(encoding="utf-8").replace("/*MAPLIBRE_CSS*/", css.read_text(encoding="utf-8"))
out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({len(html) / 1024:.0f} KB)")
