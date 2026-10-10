"""Extract the OpenStreetMap layers the grid needs from a Geofabrik extract.

Writes one GeoPackage (EPSG:4326) with a layer per theme, clipped to a lon/lat bounding box
around Denmark, and a NumPy file with the address points. The extract is read in one pass, with
the location of every node in a temporary file rather than in memory (in $TMPDIR, about 1 GB for
Denmark), so the step needs a few hundred MB of memory.

Usage:
    python -m boligmaskinen_pipeline osm <denmark-latest.osm.pbf> <out_dir>

<out_dir> gets layers.gpkg, addresses.npy and counts.json, the number of rows per layer.
"""

import argparse
import json
import tempfile
import time
from array import array
from pathlib import Path

import geopandas as gpd
import numpy as np
import osmium
import pandas as pd
import shapely

from .memory import release
from .progress import log, progress

BBOX = (7.70, 54.40, 15.50, 57.95)  # lon/lat, all of Denmark including Bornholm, plus a buffer

ROAD_CLASSES = {
    "motorway": "motorway", "motorway_link": "motorway",
    "trunk": "trunk", "trunk_link": "trunk",
    "primary": "primary", "primary_link": "primary",
    "secondary": "secondary", "secondary_link": "secondary",
}

FEATURE_TAGS = [
    ("landuse", "forest"), ("natural", "wood"),
    ("landuse", "industrial"),
    ("natural", "water"), ("waterway", "riverbank"),
    ("natural", "coastline"), ("natural", "beach"),
    ("shop", "supermarket"),
    ("railway", "station"), ("railway", "halt"),
    ("boundary", "administrative"),
    *[("highway", key) for key in ROAD_CLASSES],
    ("power", "plant"), ("power", "generator"),
    ("aeroway", "aerodrome"),
]

# Every theme, with the columns it has besides the geometry, so each layer exists even when empty
THEMES: dict[str, list[str]] = {
    "forest": [], "industrial": [], "water": [], "coastline": [], "beach": [], "solar": [],
    "supermarket": ["name"], "station": ["name"], "municipality": ["name", "ref"], "country": [], "road": ["road_class"],
    "aerodrome": ["name", "kind"],
}


def classify(tags) -> str | None:
    """Map OSM tags to a theme."""
    landuse, natural = tags.get("landuse"), tags.get("natural")
    if landuse == "forest" or natural == "wood":
        return "forest"
    if landuse == "industrial":
        return "industrial"
    if natural == "water" or tags.get("waterway") == "riverbank":
        return "water"
    if natural == "coastline":
        return "coastline"
    if natural == "beach":
        return "beach"
    if tags.get("shop") == "supermarket":
        return "supermarket"
    if tags.get("railway") in ("station", "halt"):
        if tags.get("disused") == "yes" or tags.get("usage") == "tourism" or tags.get("railway:preserved") == "yes":
            return None
        return "station"
    if tags.get("boundary") == "administrative" and tags.get("admin_level") == "7":
        return "municipality"
    if tags.get("boundary") == "administrative" and tags.get("admin_level") == "2" and tags.get("name") == "Danmark":
        return "country"  # includes the territorial sea, so it also tells where the sea is
    if tags.get("highway") in ROAD_CLASSES:
        return "road"
    # Solar parks: a plant, or the panels on the ground; not those on a roof
    if (tags.get("power") == "plant" and tags.get("plant:source") == "solar") or (
            tags.get("power") == "generator" and tags.get("generator:source") == "solar"
            and tags.get("location") not in ("roof", "rooftop") and tags.get("generator:place") not in ("roof", "rooftop")):
        return "solar"
    if tags.get("aeroway") == "aerodrome" and tags.get("disused") != "yes" and tags.get("abandoned") != "yes":
        return "aerodrome"
    return None


def aerodrome_kind(tags) -> str:
    """An air station (military), an airport (one with an IATA code, as airlines name them), or another
    airfield: a public, private, gliding or microlight field, or a seaplane base."""
    if (tags.get("military") == "airfield" or tags.get("landuse") == "military"
            or "military" in (tags.get("aerodrome:type"), tags.get("aerodrome"))):
        return "air_station"
    if tags.get("iata"):
        return "airport"
    return "airfield"


def build_layers(pbf: Path, locations: Path) -> dict[str, dict[str, list]]:
    """The tagged objects of the extract per theme: a column of WKB geometries, and their attributes.

    The node locations go into the file `locations`; pyosmium assembles the areas of the
    multipolygon relations that have the tags the map uses.
    """
    wkb = osmium.geom.WKBFactory()
    rows = {theme: {"geometry": [], **{column: [] for column in columns}} for theme, columns in THEMES.items()}
    processor = (osmium.FileProcessor(str(pbf))
                 .with_locations(f"sparse_file_array,{locations}")
                 .with_areas(osmium.filter.TagFilter(*FEATURE_TAGS))
                 .with_filter(osmium.filter.TagFilter(*FEATURE_TAGS)))
    for obj in processor:
        theme = classify(obj.tags)
        if theme is None:
            continue
        kind = obj.type_str()
        try:
            if kind == "n" and theme in ("supermarket", "station", "beach", "aerodrome"):
                geom = wkb.create_point(obj)
            elif kind == "w" and theme in ("coastline", "road"):
                geom = wkb.create_linestring(obj)
            elif kind == "a" and theme in ("forest", "industrial", "water", "beach", "supermarket", "municipality", "country", "solar", "aerodrome"):
                geom = wkb.create_multipolygon(obj)
            else:
                continue
        except (RuntimeError, osmium.InvalidLocationError):
            continue
        row = rows[theme]
        row["geometry"].append(bytes.fromhex(geom))
        if theme == "road":
            row["road_class"].append(ROAD_CLASSES[obj.tags["highway"]])
        if theme in ("municipality", "station", "supermarket", "aerodrome"):
            row["name"].append(obj.tags.get("name", ""))
        if theme == "aerodrome":
            row["kind"].append(aerodrome_kind(obj.tags))
        if theme == "municipality":
            row["ref"].append(obj.tags.get("ref", ""))  # the municipality code Danmarks Statistik uses
    return rows


def extract_addresses(pbf: Path, out: Path) -> int:
    """Collect lon/lat of every node with a house number inside the bounding box."""
    west, south, east, north = BBOX
    points = array("d")
    for obj in osmium.FileProcessor(str(pbf), osmium.osm.NODE).with_filter(osmium.filter.KeyFilter("addr:housenumber")):
        location = obj.location
        if location.valid() and west <= location.lon <= east and south <= location.lat <= north:
            points.extend((location.lon, location.lat))
    np.save(out, np.frombuffer(points, dtype=np.float64).reshape(-1, 2))
    return len(points) // 2


def extract(pbf: Path, out_dir: Path) -> dict[str, int]:
    """Write layers.gpkg and addresses.npy for the extract; returns the number of rows per layer."""
    out_dir.mkdir(parents=True, exist_ok=True)
    started = time.time()
    with tempfile.TemporaryDirectory(prefix="osm-") as tmp:
        rows = build_layers(pbf, Path(tmp) / "locations")
    log(f"Read the extract in {time.time() - started:.0f} s")
    progress(0.6)

    started = time.time()
    clip = shapely.box(*BBOX)
    out_gpkg = out_dir / "layers.gpkg"
    out_gpkg.unlink(missing_ok=True)
    counts = {}
    for theme, columns in THEMES.items():
        data = rows.pop(theme)
        frame = gpd.GeoDataFrame({column: pd.Series(data[column], dtype=object) for column in columns},
                                 geometry=shapely.from_wkb(data.pop("geometry")), crs="EPSG:4326")
        frame = frame[frame.intersects(clip)]
        frame.to_file(out_gpkg, layer=theme, driver="GPKG")
        counts[theme] = len(frame)
        del data, frame
        release()
    log(f"Built the layers in {time.time() - started:.0f} s: " + ", ".join(f"{theme} {count:,}" for theme, count in counts.items()))
    progress(0.8)

    started = time.time()
    counts["addresses"] = extract_addresses(pbf, out_dir / "addresses.npy")
    log(f"Addresses: {counts['addresses']:,} in {time.time() - started:.0f} s")
    (out_dir / "counts.json").write_text(json.dumps(counts), encoding="utf-8")
    progress(1)
    return counts


def cli(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="osm", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pbf", type=Path)
    parser.add_argument("out_dir", type=Path)
    args = parser.parse_args(argv)
    extract(args.pbf, args.out_dir)
