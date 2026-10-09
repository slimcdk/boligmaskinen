import json

import pytest

from boligmaskinen_pipeline import world


def test_builds_the_world_map_from_natural_earth(natural_earth, tmp_path):
    world.cli([str(tmp_path / "world"), *map(str, natural_earth)])
    read = lambda name: json.loads((tmp_path / "world" / f"{name}.json").read_text())["features"]  # noqa: E731
    assert len(read("land")) == 1
    assert [f["geometry"]["type"] for f in read("lakes")] == ["Polygon"]  # only the large lake
    assert read("boundaries")[0]["geometry"]["coordinates"] == [[8.6, 54.9], [9.9, 54.8]]
    assert read("countries") == [{"type": "Feature", "properties": {"name": "Denmark", "rank": 4},
                                  "geometry": {"type": "Point", "coordinates": [9.019, 55.967]}}]
    # The large places, the most populous first
    assert [(f["properties"]["name"], f["properties"]["capital"]) for f in read("places")] == [("Copenhagen", 1), ("Aarhus", 0)]


def test_needs_every_file(natural_earth, tmp_path):
    with pytest.raises(SystemExit, match="Missing Natural Earth files: ne_50m_land"):
        world.cli([str(tmp_path / "world"), *map(str, natural_earth[1:])])
