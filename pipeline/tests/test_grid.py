import gzip
import json
import math
from pathlib import Path

import numpy as np
import pytest
import shapely
from pyproj import Transformer
from rasterio.features import rasterize
from scipy import ndimage

from boligmaskinen_pipeline import grid

TO_MERCATOR = Transformer.from_crs("EPSG:25832", "EPSG:3857", always_xy=True)
LONLAT_TO_MERCATOR = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)


class Built:
    """A grid build, read back as the frontend reads it."""

    def __init__(self, out: Path):
        self.meta = json.loads((out / "meta.json").read_text(encoding="utf-8"))
        width, height = self.meta["width"], self.meta["height"]
        self.layers = {name: np.frombuffer(gzip.decompress((out / file).read_bytes()), dtype=np.uint8).reshape(height, width)
                       for name, file in self.meta["files"].items()}
        bounds = self.meta["bounds"]
        self.west, self.north = LONLAT_TO_MERCATOR.transform(bounds["west"], bounds["north"])
        self.east, self.south = LONLAT_TO_MERCATOR.transform(bounds["east"], bounds["south"])

    def at(self, layer: str, x: float, y: float) -> int:
        """The value of a layer at a point in EPSG:25832."""
        mx, my = TO_MERCATOR.transform(x, y)
        col = math.floor((mx - self.west) / (self.east - self.west) * self.meta["width"])
        row = math.floor((self.north - my) / (self.north - self.south) * self.meta["height"])
        assert 0 <= col < self.meta["width"] and 0 <= row < self.meta["height"], f"({x}, {y}) is outside the display grid"
        return int(self.layers[layer][row, col])


def decode_distance(value: int) -> float:
    return (value / 255) ** 2 * grid.DIST_MAX


@pytest.fixture(scope="module")
def aarhus(sources, tmp_path_factory) -> Built:
    out = tmp_path_factory.mktemp("grid") / "aarhus"
    grid.build(grid.read_inputs(sources), out, "aarhus")
    return Built(out)


def test_writes_every_layer_on_the_display_grid(aarhus: Built):
    meta = aarhus.meta
    assert meta["region"] == {"id": "aarhus", "name": "Aarhus Kommune"}
    assert (meta["cellMetres"], meta["gridMetres"]) == (100, 100)
    assert list(meta["files"]) == grid.LAYERS
    assert all(layer.shape == (meta["height"], meta["width"]) for layer in aarhus.layers.values())
    # The 10 km square of the region, about 100 m on the ground per cell
    assert 98 <= meta["width"] <= 106 and 98 <= meta["height"] <= 106


def test_counts_what_each_source_has(aarhus: Built):
    counts = aarhus.meta["counts"]
    assert {key: counts[key] for key in ["addresses", "supermarkets", "stations", "schools", "daycare", "turbines"]} == {
        "addresses": 40, "supermarkets": 2, "stations": 1, "schools": 2, "daycare": 2, "turbines": 2,
    }
    assert counts["regionLandCells"] > 9_000  # 100 km² of land less the lake
    assert counts["homeCells"] >= 9  # the 300 m block of homes, not the addresses in the industrial area


def test_measures_distances_from_every_cell(aarhus: Built):
    assert aarhus.at("forest", 572_500, 6_217_500) == 0
    assert decode_distance(aarhus.at("forest", 572_500, 6_220_500)) == pytest.approx(2_500, abs=150)
    # The small wood is less than 5 ha, so it does not count
    assert decode_distance(aarhus.at("forest", 571_050, 6_216_050)) > 1_000
    # Lakes and the sea east of the land count as water
    assert aarhus.at("water", 576_300, 6_220_300) == 0
    assert decode_distance(aarhus.at("water", 579_950, 6_216_500)) < 150
    # The display grid samples the 100 m grid, so a cell is within a diagonal of the school
    assert decode_distance(aarhus.at("school", 573_900, 6_219_100)) < 150
    # The closed school does not count
    assert decode_distance(aarhus.at("school", 575_500, 6_216_500)) > 2_000


def test_measures_the_distance_to_a_turbine_in_its_heights(aarhus: Built):
    # 1,200 m from the turbine of 150 m is 8 of its heights (Danish rules allow 4 to a neighbour),
    # give or take a cell of 100 m
    raw = aarhus.at("turbine_heights", 571_700, 6_220_000)
    assert (raw - 1) / grid.TURBINE_HEIGHT_STEPS == pytest.approx(8.0, abs=0.8)
    assert decode_distance(aarhus.at("turbine", 571_700, 6_220_000)) == pytest.approx(1_200, abs=150)
    # Far from it, more than the layer holds; the turbine without a height counts as distance only
    assert aarhus.at("turbine_heights", 579_500, 6_224_500) == 255


def test_measures_the_distance_to_solar_parks_of_at_least_1_ha(aarhus: Built):
    assert aarhus.at("solar", 577_100, 6_216_100) == 0
    assert decode_distance(aarhus.at("solar", 577_100, 6_218_100)) == pytest.approx(1_900, abs=150)
    # The small one does not count
    assert decode_distance(aarhus.at("solar", 571_530, 6_223_530)) > 5_000


def test_measures_the_distance_to_pharmacies_and_libraries(aarhus: Built):
    # Within a cell or so: the display grid may sample a cell beside the one with the pharmacy
    assert decode_distance(aarhus.at("pharmacy", 576_000, 6_221_000)) < 200
    assert decode_distance(aarhus.at("pharmacy", 576_000, 6_218_000)) == pytest.approx(3_000, abs=150)
    # From the middle of the library's building
    assert decode_distance(aarhus.at("library", 579_000, 6_222_000)) < 200
    assert decode_distance(aarhus.at("library", 579_000, 6_219_000)) == pytest.approx(3_000, abs=150)
    assert (aarhus.meta["counts"]["pharmacies"], aarhus.meta["counts"]["libraries"]) == (1, 1)


def test_measures_the_distance_to_airports_air_stations_and_any_airfield(aarhus: Built):
    assert aarhus.at("airport", 570_500, 6_224_500) == 0
    assert decode_distance(aarhus.at("airport", 570_500, 6_221_500)) == pytest.approx(2_500, abs=150)
    assert aarhus.at("air_station", 578_700, 6_223_700) == 0
    assert decode_distance(aarhus.at("air_station", 578_750, 6_220_000)) == pytest.approx(3_500, abs=150)
    # Every kind is an airfield, also the gliding field that is only a point
    assert aarhus.at("airfield", 571_050, 6_216_050) == 0
    assert aarhus.at("airfield", 578_700, 6_223_700) == 0
    assert decode_distance(aarhus.at("airfield", 571_050, 6_219_050)) == pytest.approx(3_000, abs=150)
    assert decode_distance(aarhus.at("airport", 571_050, 6_216_050)) == pytest.approx(7_950, abs=150)


def test_measures_the_distance_to_protected_areas_in_force_and_natura_2000(aarhus: Built):
    assert aarhus.at("protected_area", 574_500, 6_223_000) == 0
    assert decode_distance(aarhus.at("protected_area", 574_500, 6_220_500)) == pytest.approx(2_000, abs=150)
    # The small one counts, though it covers no cell's centre (the display grid may sample a cell beside
    # it); the proposal and the land around the church do not
    assert decode_distance(aarhus.at("protected_area", 577_535, 6_220_535)) < 200
    assert decode_distance(aarhus.at("protected_area", 576_250, 6_216_750)) > 3_000
    assert decode_distance(aarhus.at("protected_area", 576_050, 6_219_050)) > 1_500
    # Both kinds of Natura 2000 area
    assert aarhus.at("natura2000", 570_500, 6_215_500) == 0
    assert aarhus.at("natura2000", 579_500, 6_224_500) == 0
    assert decode_distance(aarhus.at("natura2000", 575_000, 6_215_500)) == pytest.approx(4_000, abs=150)


def test_leaves_out_the_protected_areas_without_their_sources(sources: Path, tmp_path: Path):
    named = json.loads(sources.read_text(encoding="utf-8"))
    kept = {key: str((sources.parent / value).resolve()) for key, value in named.items()
            if key not in ("protected_areas", "natura2000_habitats", "natura2000_birds")}
    (tmp_path / "inputs.json").write_text(json.dumps(kept), encoding="utf-8")
    meta = grid.build(grid.read_inputs(tmp_path / "inputs.json"), tmp_path / "out", "aarhus")
    assert list(meta["files"]) == [name for name in grid.LAYERS if name not in ("protected_area", "natura2000")]


def test_knows_the_zones_and_the_municipality(aarhus: Built):
    assert aarhus.at("zone", 574_000, 6_219_000) == 1  # byzone
    assert aarhus.at("zone", 579_500, 6_215_500) == 3  # sommerhusområde
    assert aarhus.at("zone", 571_500, 6_223_000) == 2  # landzone
    assert aarhus.at("municipality", 575_000, 6_220_000) == 1
    assert aarhus.meta["municipalities"] == [{
        "index": 1, "code": "751", "name": "Aarhus", "incomeTax": 24.52, "landTax": 6.0, "population": 378_270,
        "burglariesPer1000": round(1300 / 378_270 * 1000, 2),
    }]


def test_marks_land_and_homes(aarhus: Built):
    assert aarhus.at("mask", 574_000, 6_219_000) == 3  # land with homes
    assert aarhus.at("mask", 571_500, 6_223_000) == 1  # land without
    assert aarhus.at("mask", 578_500, 6_218_500) == 1  # addresses in an industrial area are not homes
    assert aarhus.at("mask", 576_300, 6_220_300) == 0  # the lake


def test_takes_noise_from_the_noise_map_where_it_has_some(aarhus: Built):
    assert aarhus.at("noise", 575_000, 6_222_000) == 167  # the 65–69 dB band, marked with 100
    estimate = aarhus.at("noise", 575_000, 6_216_000)
    assert estimate < 100 and estimate >= grid.NOISE_FLOOR


def test_takes_the_railway_s_band_where_it_is_louder_than_the_road(aarhus: Built):
    # Far from the roads, the railway's 60–64 dB band
    assert aarhus.at("noise", 571_000, 6_218_000) == 162
    # Where it crosses the secondary road, the road's estimate is louder
    crossing = aarhus.at("noise", 574_000, 6_218_000)
    assert 62 < crossing < 100


def test_puts_the_air_quality_of_each_square_on_its_cells(aarhus: Built, sources, tmp_path):
    # NO₂ is 5 + the kilometres from the west edge, in steps of 1/4 µg/m³; PM2.5 is 5.5 in steps of 1/10
    assert aarhus.at("no2", 574_500, 6_219_500) == 1 + 9 * 4
    assert aarhus.at("no2", 570_500, 6_219_500) == 1 + 5 * 4
    assert aarhus.at("pm25", 576_500, 6_222_500) == 1 + 55
    # Without the source, the layers have no data and the build goes on
    named = {key: str(sources.parent / path) for key, path in json.loads(sources.read_text()).items() if key not in ("no2", "pm25")}
    (tmp_path / "inputs.json").write_text(json.dumps(named))
    grid.build(grid.read_inputs(tmp_path / "inputs.json"), tmp_path / "out", "aarhus")
    assert not np.frombuffer(gzip.decompress((tmp_path / "out" / "no2.u8.gz").read_bytes()), dtype=np.uint8).any()


def test_builds_with_another_cell_size(sources, tmp_path):
    grid.build(grid.read_inputs(sources), tmp_path / "out", "aarhus", cell=200)
    built = Built(tmp_path / "out")
    assert (built.meta["cellMetres"], built.meta["gridMetres"]) == (200, 200)
    assert 49 <= built.meta["width"] <= 53
    assert built.at("zone", 574_000, 6_219_000) == 1
    assert built.at("forest", 572_500, 6_217_500) == 0
    assert built.at("mask", 574_000, 6_219_000) == 3


def test_builds_a_region_of_listed_municipalities(sources, tmp_path):
    grid.build(grid.read_inputs(sources), tmp_path / "out", "751,730")
    built = Built(tmp_path / "out")
    assert built.meta["region"] == {"id": "751,730", "name": "Aarhus, Randers"}
    assert built.at("municipality", 575_000, 6_230_000) == 2
    assert [m["code"] for m in built.meta["municipalities"]] == ["751", "730"]


def test_says_what_is_missing(sources, tmp_path):
    named = {key: str(sources.parent / path) for key, path in json.loads(sources.read_text()).items()}
    (tmp_path / "inputs.json").write_text(json.dumps({key: path for key, path in named.items() if key != "noise"}))
    with pytest.raises(SystemExit, match="does not name: noise"):
        grid.read_inputs(tmp_path / "inputs.json")
    (tmp_path / "inputs.json").write_text(json.dumps({**named, "zones": str(tmp_path / "nowhere.geojson")}))
    with pytest.raises(SystemExit, match=r"Missing source files: zones \("):
        grid.read_inputs(tmp_path / "inputs.json")
    with pytest.raises(SystemExit, match="The region has to be one of"):
        grid.build(grid.read_inputs(sources), tmp_path / "out", "Aarhus")
    with pytest.raises(SystemExit, match="Municipality 999 is not in the OSM extract"):
        grid.build(grid.read_inputs(sources), tmp_path / "out", "999")


def test_cuts_the_grid_into_detail_tiles_when_the_display_grid_is_coarser(sources, tmp_path):
    meta = grid.build(grid.read_inputs(sources), tmp_path / "out", "aarhus", cell=100, display=200)
    tiles = meta["tiles"]
    assert (tiles["cellMetres"], tiles["size"], tiles["layers"]) == (100, grid.TILE, grid.LAYERS)
    # The 10 km region is about 100 cells across at 100 m: one tile
    assert (tiles["columns"], tiles["rows"], tiles["available"]) == (1, 1, ["0-0"])
    data = np.frombuffer(gzip.decompress((tmp_path / "out" / "tiles" / "0-0.u8.gz").read_bytes()), dtype=np.uint8)
    assert data.size == len(grid.LAYERS) * grid.TILE ** 2
    layer = {name: data[k * grid.TILE ** 2:(k + 1) * grid.TILE ** 2].reshape(grid.TILE, grid.TILE) for k, name in enumerate(grid.LAYERS)}
    # A tile cell is a grid cell: the tile's pixel (row r, column c) maps like the display grid's, at half its size
    built = Built(tmp_path / "out")
    mx, my = TO_MERCATOR.transform(574_000, 6_219_000)
    col = math.floor((mx - tiles["origin"]["x"]) / tiles["pixel"])
    row = math.floor((tiles["origin"]["y"] - my) / tiles["pixel"])
    assert layer["zone"][row, col] == 1 == built.at("zone", 574_000, 6_219_000)
    # The homes are the grid's own, not widened to the 200 m display cells
    assert (layer["mask"] & 2).astype(bool).sum() == 12
    assert (built.layers["mask"] & 2).astype(bool).sum() > 3
    # Without a coarser display grid there are no tiles
    assert "tiles" not in grid.build(grid.read_inputs(sources), tmp_path / "same", "aarhus", cell=100)


def test_distances_in_blocks_are_scipys_up_to_the_limit(monkeypatch):
    """Worked out in blocks with a margin, the distances are SciPy's own up to the limit."""
    monkeypatch.setattr(grid, "DISTANCE_BLOCK", 16)
    g = grid.Grid(0, 0, 7_000, 5_000, 100)
    mask = np.random.default_rng(1).random(g.shape) < 0.002
    exact = (ndimage.distance_transform_edt(~mask) * g.cell).astype(np.float32)
    blocks = g.distance_to(mask, limit=1_000)
    near = exact <= 1_000
    assert near.any() and (~near).any()
    assert np.array_equal(blocks[near], exact[near])
    # Farther than the limit it is only known to be farther
    assert (blocks[~near] > 1_000).all()
    assert np.isinf(g.distance_to(np.zeros(g.shape, dtype=bool))).all()


def test_burns_a_few_vertices_at_a_time_as_in_one_go(monkeypatch):
    g = grid.Grid(0, 0, 2_000, 2_000, 100)
    shapes = [shapely.box(i * 100, i * 50, i * 100 + 450, i * 50 + 300) for i in range(12)]
    whole = rasterize([(shape, 7) for shape in shapes], out_shape=g.shape, transform=g.transform, fill=0, dtype="uint8")
    monkeypatch.setattr(grid, "BURN_VERTICES", 10)
    assert np.array_equal(g.burn(shapes, value=7), whole)
    assert whole.any()
