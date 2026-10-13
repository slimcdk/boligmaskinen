import json
import math
from pathlib import Path

import numpy as np
import pytest
import shapely
from pmtiles.reader import MmapSource, Reader
from pmtiles.tile import TileType
from rasterio.io import MemoryFile

from boligmaskinen_pipeline import terrain
from conftest import lonlat


def outline(path: Path, west: float, south: float, east: float, north: float) -> Path:
    ring = [[west, south], [east, south], [east, north], [west, north], [west, south]]
    path.write_text(json.dumps({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [ring]}}]}))
    return path


def decode(data: bytes) -> np.ndarray:
    with MemoryFile(data) as memory, memory.open() as tile:
        r, g, b = tile.read().astype(np.float64)
    return r * 256 + g + b / 256 - 32768


def pixel(z: int, x: int, y: int, lon: float, lat: float) -> tuple[int, int]:
    """The row and column of a point in a tile."""
    n = 2**z * terrain.TILE
    px = (lon + 180) / 360 * n - x * terrain.TILE
    py = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n - y * terrain.TILE
    return int(py), int(px)


@pytest.fixture(scope="module")
def built(sources: Path, tmp_path_factory) -> tuple[dict, Path]:
    root = tmp_path_factory.mktemp("terrain")
    dem = sources.parent / "dem"
    out = root / "terrain.pmtiles"
    summary = terrain.build(outline(root / "outline.geojson", 9.95, 56.05, 10.45, 56.35), out, [dem / "west.tif", dem / "east.tif"], max_zoom=9)
    return summary, out


def test_terrarium_keeps_the_height_to_a_quarter_metre():
    metres = np.array([[-3.0, 0.0, 20.1, 175.62]], dtype=np.float32)
    rgb = terrain.terrarium(metres)
    r, g, b = rgb.astype(np.float64)
    assert np.allclose(r * 256 + g + b / 256 - 32768, [[-3.0, 0.0, 20.0, 175.5]])


def test_makes_the_tiles_over_the_outline(built):
    summary, out = built
    with open(out, "rb") as f:
        reader = Reader(MmapSource(f))
        header = reader.header()
        metadata = reader.metadata()
        assert header["tile_type"] == TileType.WEBP
        assert (header["min_zoom"], header["max_zoom"]) == (terrain.MIN_ZOOM, 9)
        assert metadata["encoding"] == "terrarium" and metadata["tileSize"] == terrain.TILE
        assert "Copernicus" in metadata["attribution"]
        # Every tile over the outline has land in it
        area = shapely.box(9.95, 56.05, 10.45, 56.35)
        assert summary["tiles"] == sum(len(terrain.tiles_over(area, z)) for z in range(terrain.MIN_ZOOM, 10))
        assert summary["maxZoom"] == 9


def test_heights_follow_the_model(built):
    _, out = built
    z = 9

    def height(lon: float, lat: float) -> float:
        x, y = terrain.tile_of(lon, lat, z)
        return float(decode(reader.get(z, x, y))[pixel(z, x, y, lon, lat)])

    with open(out, "rb") as f:
        reader = Reader(MmapSource(f))
        # The west tile's ground of 20 m, with roofs of 30 m on every fifth column, in the mean of a pixel
        assert 20 <= height(*lonlat(572_500, 6_220_000)) <= 30
        # The east tile's ground of 50 m, west of the sea
        assert abs(height(*lonlat(577_000, 6_220_000)) - 50) < 0.5
        # The sea, and the land the model does not cover, are 0
        assert height(10.45, 56.12) == 0
        assert height(9.87, 56.12) == 0  # west of the model, in the same tile


def test_leaves_out_tiles_without_land(sources: Path, tmp_path):
    dem = sources.parent / "dem"
    with pytest.raises(SystemExit, match="no land"):
        # In the Atlantic, where not even the coarsest tiles reach the model
        terrain.build(outline(tmp_path / "sea.geojson", -30.0, 57.0, -29.9, 57.1), tmp_path / "sea.pmtiles", [dem / "west.tif"], max_zoom=7)
