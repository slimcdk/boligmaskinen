"""Pack the pilot's binary files into types the artifact host serves.

The host serves images and JSON but not arbitrary binary files, so:
- binary payloads (basemap chunks, feature rasters) become "byte container"
  PNGs: an 8-bit grayscale image whose rows hold the bytes, unfiltered, with
  the payload length in a tEXt chunk. The page inflates IDAT and strips the
  filter byte of each row to get the exact bytes back.
- glyph PBFs become one JSON file of base64 strings.

The basemap is split into parts that are fetched only when the map needs a tile in them,
so smaller parts make the first map appear sooner.

Usage:
    python pack_site.py <site_dir> <basemap.pmtiles> <glyph_dir> <out_dir>
"""

import base64
import gzip
import json
import shutil
import struct
import sys
import zlib
from pathlib import Path

ROW = 4096
CHUNK = 5_000_000  # bytes of basemap per container; the host's limit is 15 MB per file


def png_container(payload: bytes) -> bytes:
    height = max(1, -(-len(payload) // ROW))
    padded = payload + bytes(ROW * height - len(payload))
    raw = b"".join(b"\x00" + padded[i * ROW:(i + 1) * ROW] for i in range(height))

    def chunk(kind: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", ROW, height, 8, 0, 0, 0, 0))
            + chunk(b"tEXt", b"length\x00" + str(len(payload)).encode())
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


def main() -> None:
    site, basemap, glyphs, out = (Path(arg) for arg in sys.argv[1:5])
    if out.exists():
        shutil.rmtree(out)
    (out / "data").mkdir(parents=True)
    (out / "basemap").mkdir()

    archive = basemap.read_bytes()
    parts = [archive[i:i + CHUNK] for i in range(0, len(archive), CHUNK)]
    for index, part in enumerate(parts):
        (out / "basemap" / f"part-{index}.png").write_bytes(png_container(part))

    meta = json.loads((site / "data" / "meta.json").read_text())
    for name, file in list(meta["files"].items()):
        payload = gzip.decompress((site / "data" / file).read_bytes())
        target = f"{name}.png"
        (out / "data" / target).write_bytes(png_container(payload))
        meta["files"][name] = target
    meta["basemap"] = {"parts": len(parts), "chunkSize": CHUNK, "size": len(archive)}
    (out / "data" / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    shutil.copy(site / "data" / "municipalities.json", out / "data" / "municipalities.json")

    fonts = {}
    for pbf in sorted(glyphs.glob("*/*.pbf")):
        fonts[f"{pbf.parent.name}/{pbf.stem}"] = base64.b64encode(pbf.read_bytes()).decode()
    (out / "fonts.json").write_text(json.dumps(fonts))

    shutil.copytree(site / "sprites", out / "sprites")
    if (site / "world").exists():
        shutil.copytree(site / "world", out / "world")
    shutil.copy(site / "style-layers.json", out / "style-layers.json")
    for path in sorted(out.rglob("*")):
        if path.is_file():
            print(f"{path.stat().st_size / 1e6:8.2f} MB  {path.relative_to(out)}")


if __name__ == "__main__":
    main()
