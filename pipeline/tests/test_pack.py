import gzip
import json
import os
from pathlib import Path

import pytest

from boligmaskinen_pipeline import grid, pack


@pytest.fixture(scope="module")
def parts(sources, tmp_path_factory) -> dict[str, Path]:
    """What the pack step takes: a grid build, a basemap, fonts, sprites, styles and world files."""
    root = tmp_path_factory.mktemp("parts")
    grid.build(grid.read_inputs(sources), root / "grid", "aarhus", display=200)
    (root / "basemap.pmtiles").write_bytes(os.urandom(2 * pack.CHUNK + 12_345))
    for font in ["noto-regular", "noto-medium"]:
        (root / "fonts" / font).mkdir(parents=True)
        for glyphs in ["0-255", "256-511"]:
            (root / "fonts" / font / f"{glyphs}.pbf").write_bytes(f"{font} {glyphs}".encode())
    (root / "sprites").mkdir()
    for name in pack.SPRITES:
        (root / "sprites" / name).write_text(name)
    (root / "styles").mkdir()
    for name in pack.STYLES:
        (root / "styles" / name).write_text("[]")
    (root / "world").mkdir()
    for name in pack.WORLD:
        (root / "world" / name).write_text('{"type":"FeatureCollection","features":[]}')
    return {name: root / name for name in ["grid", "fonts", "sprites", "styles", "world"]} | {"basemap": root / "basemap.pmtiles"}


def test_packs_everything_the_map_loads(parts, tmp_path):
    out = tmp_path / "pack"
    pack.build(**parts, out=out, pack_id="20261009-0630")
    meta = json.loads((out / "data" / "meta.json").read_text())
    assert meta["pack"] == "20261009-0630"
    assert meta["files"] == {name: f"{name}.png" for name in grid.LAYERS}
    assert meta["basemap"] == {"parts": 3, "chunkSize": pack.CHUNK, "size": 2 * pack.CHUNK + 12_345}
    # Every layer comes back byte for byte from its container
    for name in grid.LAYERS:
        assert pack.read_container((out / "data" / f"{name}.png").read_bytes()) == gzip.decompress((parts["grid"] / f"{name}.u8.gz").read_bytes())
    basemap = b"".join(pack.read_container((out / "basemap" / f"part-{i}.png").read_bytes()) for i in range(3))
    assert basemap == parts["basemap"].read_bytes()
    fonts = json.loads((out / "fonts.json").read_text())
    assert sorted(fonts) == ["noto-medium/0-255", "noto-medium/256-511", "noto-regular/0-255", "noto-regular/256-511"]
    assert sorted(path.name for path in (out / "sprites").iterdir()) == sorted(pack.SPRITES)
    assert sorted(path.name for path in (out / "world").iterdir()) == sorted(pack.WORLD)
    assert (out / "style-layers-dark.json").read_text() == "[]"
    assert (out / "data" / "municipalities.json").is_file()
    # The chargers for electric cars, as points
    assert meta["sites"] == {"chargers": "chargers.json"}
    assert (out / "data" / "chargers.json").read_bytes() == (parts["grid"] / "chargers.json").read_bytes()
    # The detail tiles come along, each in a container of its own
    assert meta["tiles"]["available"] == ["0-0"]
    assert pack.read_container((out / "tiles" / "0-0.png").read_bytes()) == gzip.decompress((parts["grid"] / "tiles" / "0-0.u8.gz").read_bytes())


def test_makes_a_valid_png(parts, tmp_path):
    png = pack.png_container(b"\x01\x02\x03")
    assert png.startswith(b"\x89PNG\r\n\x1a\n") and png.endswith(b"IEND\xaeB`\x82")
    assert pack.read_container(png) == b"\x01\x02\x03"
    assert pack.read_container(pack.png_container(b"")) == b""


def test_refuses_to_pack_without_its_parts_or_over_a_pack(parts, tmp_path):
    (tmp_path / "exists").mkdir()
    (tmp_path / "exists" / "fonts.json").write_text("{}")
    with pytest.raises(SystemExit, match="is not empty"):
        pack.build(**parts, out=tmp_path / "exists")
    with pytest.raises(SystemExit, match="sprites in .* lack light.json"):
        pack.build(**{**parts, "sprites": parts["styles"]}, out=tmp_path / "pack")
    with pytest.raises(SystemExit, match="There are no fonts"):
        pack.build(**{**parts, "fonts": tmp_path / "exists"}, out=tmp_path / "pack")
    # An empty folder is fine, as the jobs make one to build in
    (tmp_path / "empty").mkdir()
    assert pack.build(**parts, out=tmp_path / "empty")["basemap"]["parts"] == 3
    assert not (tmp_path / "pack").exists()
