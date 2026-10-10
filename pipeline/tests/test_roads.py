import json
import math

import numpy as np
import osmium
import pytest
from osmium.osm.mutable import Node, Way
from pyproj import Transformer

from boligmaskinen_pipeline import roads, travel
from boligmaskinen_pipeline.pack import png_container, read_container

TO_MERCATOR = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
# One step east along the main street, about 620 m at 56° N
STEP = 0.01


@pytest.fixture(scope="module")
def town(tmp_path_factory):
    """A small town around (10.0, 56.0): a main street of six blocks with a motorway beside it, a
    ferry to an island, and a footway inside a station that joins nothing."""
    root = tmp_path_factory.mktemp("roads")
    pbf = root / "denmark-latest.osm.pbf"
    street = [Node(id=1 + i, location=(10.0 + STEP * i, 56.0)) for i in range(6)]
    motorway = [Node(id=11 + i, location=(10.0 + STEP * i, 56.004)) for i in range(6)]
    island = [Node(id=31, location=(10.10, 56.0)), Node(id=32, location=(10.11, 56.0))]
    station = [Node(id=41, location=(10.0002, 56.0001)), Node(id=42, location=(10.0003, 56.0001))]
    ways = [
        Way(id=100, nodes=[1, 2, 3, 4, 5, 6], tags={"highway": "residential", "name": "Hovedgaden"}),
        Way(id=101, nodes=[11, 12, 13, 14, 15, 16], tags={"highway": "motorway"}),
        Way(id=102, nodes=[1, 11], tags={"highway": "motorway_link"}),
        Way(id=103, nodes=[16, 6], tags={"highway": "motorway_link"}),
        Way(id=104, nodes=[6, 31], tags={"route": "ferry", "duration": "00:30"}),
        Way(id=105, nodes=[31, 32], tags={"highway": "residential"}),
        Way(id=106, nodes=[41, 42], tags={"highway": "footway", "indoor": "yes"}),
    ]
    writer = osmium.SimpleWriter(str(pbf))
    for node in street + motorway + island + station:
        writer.add_node(node)
    for way in ways:
        writer.add_way(way)
    writer.close()
    out = root / "network"
    counts = roads.build(pbf, out)
    return root, out, counts


def test_builds_a_network_per_mode(town):
    _, out, counts = town
    assert counts["nodes"] == 16
    # Every edge of the street, the motorway, the slip roads, the ferry, the island and the station
    assert counts["edges"] == 5 + 5 + 1 + 1 + 1 + 1 + 1
    # Cars both ways on the street and the island, one way on the motorway and its slip roads, both ways on the ferry
    assert counts["carEdges"] == 2 * 5 + 5 + 2 + 2 + 2
    # Bikes and feet: not on the motorway
    assert counts["bikeEdges"] == 2 * 5 + 2 + 2
    assert counts["walkEdges"] == 2 * 5 + 2 + 2 + 2
    # Trips start in the largest network, not on the motorway nor in the station
    assert counts["carStarts"] == 6 + 2
    assert counts["walkStarts"] == 6 + 2
    assert json.loads((out / "counts.json").read_text()) == counts
    assert sorted(path.name for path in out.iterdir()) == sorted(
        ["counts.json", "x.npy", "y.npy", *(f"{mode}-{name}.npy" for mode in travel.MODES for name in ("indptr", "indices", "seconds", "start"))])


@pytest.mark.parametrize(("tags", "expected"), [
    ({"highway": "residential"}, (30, 30, 16, 16, 5)),
    ({"highway": "primary", "maxspeed": "80"}, (68, 68, 16, 16, 5)),
    ({"highway": "secondary", "maxspeed": "DK:urban"}, (42.5, 42.5, 16, 16, 5)),
    ({"highway": "residential", "oneway": "yes"}, (30, 0, 16, 0, 5)),
    ({"highway": "residential", "oneway": "-1", "oneway:bicycle": "no"}, (0, 30, 16, 16, 5)),
    ({"highway": "tertiary", "junction": "roundabout"}, (45, 0, 16, 0, 5)),
    ({"highway": "motorway"}, (110, 0, 0, 0, 0)),
    ({"highway": "trunk", "motorroad": "yes"}, (80, 80, 0, 0, 0)),
    ({"highway": "cycleway"}, (0, 0, 18, 18, 5)),
    ({"highway": "footway"}, (0, 0, 0, 0, 5)),
    ({"highway": "footway", "bicycle": "yes"}, (0, 0, 10, 10, 5)),
    ({"highway": "residential", "access": "private"}, None),
    ({"highway": "service", "access": "private", "foot": "yes"}, (0, 0, 0, 0, 5)),
    ({"highway": "steps"}, (0, 0, 0, 0, 2)),
    ({"highway": "construction"}, None),
    ({"route": "ferry", "motor_vehicle": "no"}, (0, 0, 1, 1, 1)),
])
def test_knows_who_may_go_where_and_how_fast(tags, expected):
    rule = roads.rules(tags)
    if expected is None:
        assert rule is None
    else:
        assert rule[:5] == pytest.approx(expected)


def test_reads_a_ferry_s_duration():
    assert roads.tagged_duration({"duration": "1:15"}) == 75 * 60
    assert roads.tagged_duration({"duration": "00:30:30"}) == 30 * 60 + 30
    assert roads.tagged_duration({"duration": "45"}) == 45 * 60
    assert roads.tagged_duration({"duration": "soon"}) == -1


@pytest.fixture(scope="module")
def pack(town):
    """A data pack whose map is land from 9.995° to 10.115° E, at about 100 m a cell."""
    root, _, _ = town
    pack = root / "pack"
    (pack / "data").mkdir(parents=True)
    west, east, south, north = 9.995, 10.115, 55.995, 56.010
    x0, y0 = TO_MERCATOR.transform(west, south)
    x1, y1 = TO_MERCATOR.transform(east, north)
    pixel = 100 / math.cos(math.radians(56))
    width, height = math.ceil((x1 - x0) / pixel), math.ceil((y1 - y0) / pixel)
    east, _ = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True).transform(x0 + width * pixel, y1)
    _, south = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True).transform(x0, y1 - height * pixel)
    meta = {"width": width, "height": height, "bounds": {"west": west, "south": south, "east": east, "north": north},
            "files": {"mask": "mask.png"}}
    (pack / "data" / "meta.json").write_text(json.dumps(meta))
    (pack / "data" / "mask.png").write_bytes(png_container(np.ones(width * height, dtype=np.uint8).tobytes()))
    return pack, meta, (x0, y1, pixel)


def at(layer: np.ndarray, pack, lng: float, lat: float) -> int:
    _, meta, (x0, y1, pixel) = pack
    x, y = TO_MERCATOR.transform(lng, lat)
    return int(layer[int((y1 - y) // pixel) * meta["width"] + int((x - x0) // pixel)])


def layers_of(out) -> dict[str, np.ndarray]:
    return {mode: np.frombuffer(read_container((out / f"{mode}.png").read_bytes()), dtype=np.uint8) for mode in travel.MODES}


def test_finds_the_minutes_to_a_place_by_each_mode(town, pack, tmp_path):
    _, network, _ = town
    # A place at the east end of the main street
    reached = travel.build(network, pack[0], 10.05, 56.0, tmp_path / "out", cache=tmp_path / "cache")
    layers = layers_of(tmp_path / "out")
    # From the west end, 3.1 km away: on foot at 5 km/h, by bike at 16, by car on the motorway eastwards
    start = {mode: at(layer, pack, 10.0, 56.0) for mode, layer in layers.items()}
    assert start["walk"] == pytest.approx(3.1 / 5 * 60, abs=2)
    assert start["bike"] == pytest.approx(3.1 / 16 * 60, abs=1)
    assert start["car"] < 3.1 / 30 * 60 + 2  # faster than the street at 30 km/h, with 2 minutes to park
    # The island across the ferry: its 30 minutes and the wait to board
    assert at(layers["car"], pack, 10.11, 56.0) == pytest.approx(30 + 15 + 0.62 / 30 * 60 + 2, abs=2)
    # The place itself, and a cell beside the station's footway, which joins nothing but is near the street
    assert at(layers["walk"], pack, 10.05, 56.0) <= 1
    assert at(layers["walk"], pack, 10.0003, 56.0001) == start["walk"]
    # Every land cell finds its way here on foot within 254 minutes; the cache keeps the nearest nodes
    assert reached["walk"] == int((layers["walk"] < 255).sum()) == pack[1]["width"] * pack[1]["height"]
    assert sorted(path.name for path in (tmp_path / "cache").iterdir()) == ["bike-cells.npz", "car-cells.npz", "walk-cells.npz"]


def test_goes_one_way_where_the_road_does(town, pack, tmp_path):
    _, network, _ = town
    # To the west end the motorway goes the wrong way, so cars take the street
    travel.build(network, pack[0], 10.0, 56.0, tmp_path / "west", cache=tmp_path / "cache")
    travel.build(network, pack[0], 10.05, 56.0, tmp_path / "east", cache=tmp_path / "cache")
    west, east = layers_of(tmp_path / "west"), layers_of(tmp_path / "east")
    assert at(west["car"], pack, 10.05, 56.0) == pytest.approx(3.1 / 30 * 60 + 2, abs=1.5)
    assert at(east["car"], pack, 10.0, 56.0) < at(west["car"], pack, 10.05, 56.0)
    # On foot it is the same both ways, but for where in its cell each end is
    assert at(west["walk"], pack, 10.05, 56.0) == pytest.approx(at(east["walk"], pack, 10.0, 56.0), abs=1)
