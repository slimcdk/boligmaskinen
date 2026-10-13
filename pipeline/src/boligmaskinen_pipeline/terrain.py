"""The terrain: the elevation model as tiles the map shades the land with.

The tiles of the Copernicus elevation model (GLO-30, about 30 m) go onto Web Mercator tiles of
512 px over the region, as Terrarium (the height is R × 256 + G + B / 256 − 32768 m) in lossless
WebP, in one PMTiles archive. MapLibre draws them as a hillshade when the map's background is
"Terrain" (#53).

The model is of the surface, roofs and treetops too, so a forest stands a little above the fields
around it. The sea is 0 m, and so is what no tile covers.

    python -m boligmaskinen_pipeline terrain OUTLINE OUT TILE [TILE ...] [--max-zoom 11]

OUTLINE is the region's outline (the grid's basemap-region.geojson): only the tiles over it are made.
"""

import argparse
import json
import math
import warnings
from pathlib import Path

import numpy as np
import rasterio
import shapely
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer
from rasterio.errors import NotGeoreferencedWarning
from rasterio.io import MemoryFile
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds
from shapely.geometry import box, shape

from .memory import release
from .progress import log, progress

TILE = 512  # pixels per side of a tile
MIN_ZOOM = 5
MAX_ZOOM = 11  # 22 m per pixel at 56° N, as fine as the model
# The heights are rounded to this many metres: the model is not finer, and rounded tiles pack smaller
STEP = 0.25
HALF = 20037508.342789244  # half the width of the Web Mercator world, in metres
CREDIT = ("Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 "
          "provided under COPERNICUS by the European Union and ESA; all rights reserved")


def tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    """The tile's left, bottom, right and top in Web Mercator metres."""
    size = 2 * HALF / 2**z
    left, top = -HALF + x * size, HALF - y * size
    return left, top - size, left + size, top


def tile_of(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 2**z
    lat = max(-85.0511, min(85.0511, lat))
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return min(n - 1, max(0, x)), min(n - 1, max(0, y))


def tiles_over(outline, z: int) -> list[tuple[int, int]]:
    """The tiles at zoom z that touch the outline (in degrees)."""
    west, south, east, north = outline.bounds
    x0, y0 = tile_of(west, north, z)
    x1, y1 = tile_of(east, south, z)
    found = []
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            if outline.intersects(box(*transform_bounds("EPSG:3857", "EPSG:4326", *tile_bounds(z, x, y)))):
                found.append((x, y))
    return found


def heights(sources: list, z: int, x: int, y: int, fine: bool) -> np.ndarray | None:
    """The tile's heights in metres, or None where the model has no land in it. A fine tile, near the
    model's own resolution, is interpolated; a coarser one takes the mean of the points under each pixel."""
    bounds = tile_bounds(z, x, y)
    out = np.zeros((TILE, TILE), dtype=np.float32)
    covered = False
    for src, src_bounds in sources:
        if src_bounds[0] >= bounds[2] or src_bounds[2] <= bounds[0] or src_bounds[1] >= bounds[3] or src_bounds[3] <= bounds[1]:
            continue
        part = np.full((TILE, TILE), np.nan, dtype=np.float32)
        # From the band, so GDAL reads only the window it needs, from the overviews when zoomed out
        reproject(source=rasterio.band(src, 1), destination=part, dst_transform=from_bounds(*bounds, TILE, TILE),
                  dst_crs="EPSG:3857", dst_nodata=np.nan, resampling=Resampling.bilinear if fine else Resampling.average)
        # The model's tiles meet at their edges; each fills in where the others have nothing
        out = np.where(np.isnan(part), out, part)
        covered = True
    if not covered or not (out > 0).any():
        return None
    return out


def terrarium(metres: np.ndarray) -> np.ndarray:
    """Heights as the three bytes of Terrarium: R × 256 + G + B / 256 − 32768."""
    value = np.round(metres / STEP) * STEP + 32768
    whole = np.floor(value)
    return np.stack([whole // 256, whole % 256, np.round((value - whole) * 256)]).astype(np.uint8)


def webp(rgb: np.ndarray) -> bytes:
    # A tile is an image, not a map: it says nothing of where it lies, which rasterio warns about
    with warnings.catch_warnings(), MemoryFile() as memory:
        warnings.simplefilter("ignore", NotGeoreferencedWarning)
        with memory.open(driver="WEBP", width=rgb.shape[2], height=rgb.shape[1], count=3, dtype="uint8", LOSSLESS="TRUE") as dst:
            dst.write(rgb)
        return memory.read()


def build(outline_path: Path, out: Path, tiles: list[Path], max_zoom: int = MAX_ZOOM) -> dict:
    features = json.loads(outline_path.read_text())["features"]
    outline = shapely.union_all([shape(f["geometry"]) for f in features])
    wanted = sorted((zxy_to_tileid(z, x, y), z, x, y) for z in range(MIN_ZOOM, max_zoom + 1) for x, y in tiles_over(outline, z))
    log(f"Terrain: {len(wanted):,} tiles of {TILE} px from zoom {MIN_ZOOM} to {max_zoom}, from {len(tiles)} tiles of the elevation model")

    written = 0
    size = 0
    lowest, highest = math.inf, -math.inf
    out.parent.mkdir(parents=True, exist_ok=True)
    # GDAL keeps up to 5 % of the machine's memory of blocks it has read, more than a container may have
    with rasterio.Env(GDAL_CACHEMAX=64), open(out, "wb") as f:
        sources = []
        try:
            for path in tiles:
                src = rasterio.open(path)
                sources.append((src, transform_bounds(src.crs, "EPSG:3857", *src.bounds)))
            writer = Writer(f)
            for done, (tile_id, z, x, y) in enumerate(wanted):
                metres = heights(sources, z, x, y, fine=z >= max_zoom - 1)
                if metres is not None:
                    data = webp(terrarium(metres))
                    writer.write_tile(tile_id, data)
                    written += 1
                    size += len(data)
                    lowest, highest = min(lowest, float(metres.min())), max(highest, float(metres.max()))
                if done % 50 == 0:
                    progress(done / len(wanted))
                    release()
            if not written:
                raise SystemExit("The elevation model has no land in the region")
            west, south, east, north = outline.bounds
            writer.finalize({
                "tile_type": TileType.WEBP, "tile_compression": Compression.NONE,
                "min_lon_e7": int(west * 1e7), "min_lat_e7": int(south * 1e7), "max_lon_e7": int(east * 1e7), "max_lat_e7": int(north * 1e7),
                "center_zoom": MIN_ZOOM + 2, "center_lon_e7": int((west + east) / 2 * 1e7), "center_lat_e7": int((south + north) / 2 * 1e7),
            }, {"name": "Terrain", "encoding": "terrarium", "tileSize": TILE, "attribution": CREDIT})
        finally:
            for src, _ in sources:
                src.close()
    progress(1)
    summary = {"tiles": written, "bytes": out.stat().st_size, "maxZoom": max_zoom, "lowest": round(lowest, 1), "highest": round(highest, 1)}
    # Beside the archive, for the job's result
    (out.parent / "terrain.json").write_text(json.dumps(summary), encoding="utf-8")
    log(f"Terrain: {written:,} tiles with land, {summary['bytes'] / 1e6:.1f} MB; heights from {lowest:.0f} to {highest:.0f} m")
    return summary


def cli(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="terrain", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("outline", type=Path, help="the region's outline, GeoJSON in degrees")
    parser.add_argument("out", type=Path, help="the PMTiles archive to write")
    parser.add_argument("tiles", type=Path, nargs="+", help="the elevation model's GeoTIFF tiles")
    parser.add_argument("--max-zoom", type=int, default=MAX_ZOOM)
    args = parser.parse_args(argv)
    build(args.outline, args.out, args.tiles, args.max_zoom)
