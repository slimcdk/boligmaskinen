"""Pack the grid, basemap, fonts, sprites, styles and world map into the data pack the map loads.

The binary files go into standard web types, which every host serves and compresses well:
- binary payloads (basemap parts, data layers) become "byte container" PNGs: an 8-bit
  grayscale image whose rows hold the bytes, unfiltered, with the payload length in a tEXt
  chunk. The frontend inflates IDAT and strips the filter byte of each row to get the exact
  bytes back (frontend/src/app/data/byte-container.ts).
- glyph PBFs become one JSON file of base64 strings.

The basemap is split into parts that are fetched only when the map needs a tile in them,
so smaller parts make the first map appear sooner.

Usage:
    python -m boligmaskinen_pipeline pack --grid DIR --basemap FILE --fonts DIR --sprites DIR \\
        --styles DIR --world DIR --out DIR [--id ID]

--grid is the grid step's output, --fonts holds <font>/<range>.pbf, --sprites the light and dark
sprites, and --styles style-layers.json and style-layers-dark.json. --id names the pack in its
meta.json, so the app can serve it under a name of its own.
"""

import argparse
import base64
import gzip
import json
import shutil
import struct
import zlib
from pathlib import Path

from .progress import log, progress

ROW = 4096
CHUNK = 5_000_000  # bytes of basemap per container
STYLES = ["style-layers.json", "style-layers-dark.json"]
WORLD = ["land.json", "lakes.json", "boundaries.json", "countries.json", "places.json"]
SPRITES = ["light.json", "light.png", "light@2x.json", "light@2x.png", "dark.json", "dark.png", "dark@2x.json", "dark@2x.png"]


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


def read_container(png: bytes) -> bytes:
    """The payload of a byte container: the inverse of png_container."""
    pos, length, idat = 8, None, b""
    while pos < len(png):
        (size,) = struct.unpack(">I", png[pos:pos + 4])
        kind, body = png[pos + 4:pos + 8], png[pos + 8:pos + 8 + size]
        if kind == b"IHDR":
            (width,) = struct.unpack(">I", body[:4])
        elif kind == b"tEXt" and body.startswith(b"length\x00"):
            length = int(body[7:])
        elif kind == b"IDAT":
            idat += body
        pos += 12 + size
    raw = zlib.decompress(idat)
    rows = [raw[i + 1:i + 1 + width] for i in range(0, len(raw), width + 1)]
    return b"".join(rows)[:length]


def require(folder: Path, names: list[str], what: str) -> None:
    missing = [name for name in names if not (folder / name).is_file()]
    if missing:
        raise SystemExit(f"The {what} in {folder} lack {', '.join(missing)}")


def build(grid: Path, basemap: Path, fonts: Path, sprites: Path, styles: Path, world: Path, out: Path, pack_id: str | None = None) -> dict:
    """Write the data pack to `out`, which must not exist yet; returns its meta.json."""
    meta = json.loads((grid / "meta.json").read_text(encoding="utf-8"))
    require(grid, [*meta["files"].values(), "municipalities.json"], "grid files")
    require(sprites, SPRITES, "sprites")
    require(styles, STYLES, "styles")
    require(world, WORLD, "world files")
    glyphs = sorted(fonts.glob("*/*.pbf"))
    if not glyphs:
        raise SystemExit(f"There are no fonts in {fonts}")
    if out.exists():
        raise SystemExit(f"{out} exists already")
    (out / "data").mkdir(parents=True)
    (out / "basemap").mkdir()

    archive = basemap.read_bytes()
    parts = [archive[i:i + CHUNK] for i in range(0, len(archive), CHUNK)]
    for index, part in enumerate(parts):
        (out / "basemap" / f"part-{index}.png").write_bytes(png_container(part))
    progress(0.5)

    for name, file in list(meta["files"].items()):
        payload = gzip.decompress((grid / file).read_bytes())
        target = f"{name}.png"
        (out / "data" / target).write_bytes(png_container(payload))
        meta["files"][name] = target
    meta["basemap"] = {"parts": len(parts), "chunkSize": CHUNK, "size": len(archive)}
    if pack_id:
        meta["pack"] = pack_id
    (out / "data" / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    shutil.copy(grid / "municipalities.json", out / "data" / "municipalities.json")
    progress(0.8)

    fonts_json = {f"{pbf.parent.name}/{pbf.stem}": base64.b64encode(pbf.read_bytes()).decode() for pbf in glyphs}
    (out / "fonts.json").write_text(json.dumps(fonts_json), encoding="utf-8")
    (out / "sprites").mkdir()
    for name in SPRITES:
        shutil.copy(sprites / name, out / "sprites" / name)
    for name in STYLES:
        shutil.copy(styles / name, out / name)
    (out / "world").mkdir()
    for name in WORLD:
        shutil.copy(world / name, out / "world" / name)
    total = sum(path.stat().st_size for path in out.rglob("*") if path.is_file())
    log(f"Packed {len(meta['files'])} layers, {len(parts)} basemap parts and {len(glyphs)} glyph ranges: {total / 1e6:.1f} MB")
    progress(1)
    return meta


def cli(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="pack", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for name in ["grid", "fonts", "sprites", "styles", "world"]:
        parser.add_argument(f"--{name}", type=Path, required=True)
    parser.add_argument("--basemap", type=Path, required=True, help="the region's .pmtiles file")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--id", default=None)
    args = parser.parse_args(argv)
    build(args.grid, args.basemap, args.fonts, args.sprites, args.styles, args.world, args.out, args.id)
