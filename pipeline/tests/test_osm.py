import json

import numpy as np
import osmium
import pyogrio
import pytest
from osmium.osm.mutable import Node, Relation, Way

from boligmaskinen_pipeline import osm


@pytest.fixture(scope="module")
def extract(tmp_path_factory):
    """A small OSM extract around Aarhus, written as Geofabrik's are."""
    root = tmp_path_factory.mktemp("osm")
    pbf = root / "denmark-latest.osm.pbf"
    nodes = [
        # The municipality, the country and a forest, as closed rings
        Node(id=1, location=(10.0, 56.0)), Node(id=2, location=(10.2, 56.0)), Node(id=3, location=(10.2, 56.2)), Node(id=4, location=(10.0, 56.2)),
        Node(id=5, location=(9.8, 55.8)), Node(id=6, location=(10.4, 55.8)), Node(id=7, location=(10.4, 56.4)), Node(id=8, location=(9.8, 56.4)),
        Node(id=9, location=(10.05, 56.05)), Node(id=10, location=(10.07, 56.05)), Node(id=11, location=(10.07, 56.07)), Node(id=12, location=(10.05, 56.07)),
        Node(id=13, location=(10.1, 56.1), tags={"shop": "supermarket", "name": "Netto"}),
        Node(id=14, location=(10.11, 56.11), tags={"railway": "station", "name": "Aarhus H"}),
        Node(id=15, location=(10.12, 56.12), tags={"railway": "station", "name": "Museum", "railway:preserved": "yes"}),
        Node(id=16, location=(10.0, 56.15)), Node(id=17, location=(10.2, 56.15)),
        Node(id=18, location=(10.1, 56.1), tags={"addr:street": "Vej", "addr:housenumber": "1"}),
        Node(id=19, location=(10.1001, 56.1), tags={"addr:street": "Vej", "addr:housenumber": "2"}),
        Node(id=20, location=(10.1002, 56.1), tags={"addr:street": "Vej", "addr:housenumber": "3"}),
        Node(id=21, location=(20.0, 60.0), tags={"addr:street": "Far", "addr:housenumber": "9"}),  # outside Denmark
        Node(id=22, location=(10.15, 56.15), tags={"amenity": "bench"}),  # nothing the map uses
    ]
    ways = [
        Way(id=100, nodes=[1, 2, 3, 4, 1]),
        Way(id=101, nodes=[5, 6, 7, 8, 5]),
        Way(id=102, nodes=[9, 10, 11, 12, 9], tags={"landuse": "forest"}),
        Way(id=103, nodes=[16, 17], tags={"highway": "motorway"}),
    ]
    relations = [
        Relation(id=1000, members=[("w", 100, "outer")],
                 tags={"type": "boundary", "boundary": "administrative", "admin_level": "7", "name": "Aarhus Kommune", "ref": "751"}),
        Relation(id=1001, members=[("w", 101, "outer")],
                 tags={"type": "boundary", "boundary": "administrative", "admin_level": "2", "name": "Danmark"}),
    ]
    writer = osmium.SimpleWriter(str(pbf))
    for node in nodes:
        writer.add_node(node)
    for way in ways:
        writer.add_way(way)
    for relation in relations:
        writer.add_relation(relation)
    writer.close()
    out = root / "out"
    counts = osm.extract(pbf, out)
    return out, counts


def test_extracts_a_layer_per_theme(extract):
    out, counts = extract
    assert [name for name, _ in pyogrio.list_layers(out / "layers.gpkg")] == list(osm.THEMES)
    assert {theme: counts[theme] for theme in osm.THEMES} == {
        "forest": 1, "industrial": 0, "water": 0, "coastline": 0, "beach": 0,
        "supermarket": 1, "station": 1, "municipality": 1, "country": 1, "road": 1,
    }
    municipality = pyogrio.read_dataframe(out / "layers.gpkg", layer="municipality")
    assert (municipality["name"][0], municipality["ref"][0]) == ("Aarhus Kommune", "751")
    assert pyogrio.read_dataframe(out / "layers.gpkg", layer="road")["road_class"].tolist() == ["motorway"]
    assert not (out / "features.osm.pbf").exists()
    assert json.loads((out / "counts.json").read_text()) == counts


def test_extracts_the_addresses_in_denmark(extract):
    out, counts = extract
    addresses = np.load(out / "addresses.npy")
    assert counts["addresses"] == 3
    assert addresses.shape == (3, 2)
    assert addresses[0].tolist() == pytest.approx([10.1, 56.1])
