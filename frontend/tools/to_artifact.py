"""Turn the Angular build into a publishable artifact page.

The artifact host wraps the page in its own <html>/<head>/<body>, so this keeps only the
title, the stylesheet and font links, <app-root> and the module script, and copies the
built files next to it.

Usage:
    python tools/to_artifact.py <dist/frontend/browser> <out_dir>
"""

import re
import shutil
import sys
from pathlib import Path

dist, out = Path(sys.argv[1]), Path(sys.argv[2])
if out.exists():
    shutil.rmtree(out)
shutil.copytree(dist, out, ignore=shutil.ignore_patterns("index.html", "*.map"))
html = (dist / "index.html").read_text(encoding="utf-8")
title = re.search(r"<title>.*?</title>", html, re.S).group(0)
links = [link for link in re.findall(r"<link\b[^>]*>", html) if 'rel="icon"' not in link]
scripts = re.findall(r"<script\b[^>]*></script>", html)
fragment = "\n".join([title, *links, "<app-root></app-root>", *scripts]) + "\n"
(out / "index.html").write_text(fragment, encoding="utf-8")
print(fragment)
for path in sorted(p for p in out.rglob("*") if p.is_file()):
    print(f"{path.stat().st_size / 1e6:8.2f} MB  {path.relative_to(out)}")
