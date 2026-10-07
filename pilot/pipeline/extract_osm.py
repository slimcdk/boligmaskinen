"""Extract the OpenStreetMap layers the pilot needs from a Geofabrik extract.

Writes one GeoPackage (EPSG:4326) with a layer per theme, clipped to a lon/lat
bounding box around Denmark, plus a NumPy file with address points.

Usage:
    python extract_osm.py <denmark-latest.osm.pbf> <work_dir> <out.gpkg> <addresses.npy>
"""

import sys
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import osmium
import shapely

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
]


def classify(tags) -> str | None:
    """Map OSM tags to a pilot theme."""
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
    return None


def filter_features(pbf: Path, filtered: Path) -> None:
    """Write a small PBF with the tagged objects and everything they reference."""
    with osmium.BackReferenceWriter(str(filtered), ref_src=str(pbf), overwrite=True) as writer:
        for obj in osmium.FileProcessor(str(pbf)).with_filter(osmium.filter.TagFilter(*FEATURE_TAGS)):
            writer.add(obj)


def build_layers(filtered: Path) -> dict[str, list[dict]]:
    """Turn filtered OSM objects into rows of geometry and attributes per theme."""
    wkb = osmium.geom.WKBFactory()
    rows: dict[str, list[dict]] = {}
    processor = osmium.FileProcessor(str(filtered)).with_locations().with_areas()
    for obj in processor:
        theme = classify(obj.tags)
        if theme is None:
            continue
        kind = obj.type_str()
        try:
            if kind == "n" and theme in ("supermarket", "station", "beach"):
                geom = wkb.create_point(obj)
            elif kind == "w" and theme in ("coastline", "road"):
                geom = wkb.create_linestring(obj)
            elif kind == "a" and theme in ("forest", "industrial", "water", "beach", "supermarket", "municipality", "country"):
                geom = wkb.create_multipolygon(obj)
            else:
                continue
        except (RuntimeError, osmium.InvalidLocationError):
            continue
        row = {"geometry": shapely.from_wkb(geom), "osm_type": kind}
        if theme == "road":
            row["road_class"] = ROAD_CLASSES[obj.tags["highway"]]
        if theme in ("municipality", "station", "supermarket"):
            row["name"] = obj.tags.get("name", "")
        if theme == "municipality":
            row["ref"] = obj.tags.get("ref", "")  # the municipality code Danmarks Statistik uses
        rows.setdefault(theme, []).append(row)
    return rows


def extract_addresses(pbf: Path, out: Path) -> int:
    """Collect lon/lat of every node with a house number inside the bounding box."""
    west, south, east, north = BBOX
    points = []
    for obj in osmium.FileProcessor(str(pbf), osmium.osm.NODE).with_filter(osmium.filter.KeyFilter("addr:housenumber")):
        location = obj.location
        if location.valid() and west <= location.lon <= east and south <= location.lat <= north:
            points.append((location.lon, location.lat))
    np.save(out, np.asarray(points, dtype=np.float64))
    return len(points)


def main() -> None:
    pbf, work_dir, out_gpkg, out_addresses = (Path(arg) for arg in sys.argv[1:5])
    work_dir.mkdir(parents=True, exist_ok=True)
    filtered = work_dir / "features.osm.pbf"

    started = time.time()
    if not filtered.exists():
        filter_features(pbf, filtered)
    print(f"filtered features in {time.time() - started:.0f}s ({filtered.stat().st_size / 1e6:.1f} MB)")

    started = time.time()
    rows = build_layers(filtered)
    clip = shapely.box(*BBOX)
    if out_gpkg.exists():
        out_gpkg.unlink()
    for theme, theme_rows in rows.items():
        frame = gpd.GeoDataFrame(theme_rows, geometry="geometry", crs="EPSG:4326")
        frame = frame[frame.intersects(clip)]
        frame.to_file(out_gpkg, layer=theme, driver="GPKG")
        print(f"  {theme:<13} {len(frame):>8,}")
    print(f"built layers in {time.time() - started:.0f}s")

    started = time.time()
    count = extract_addresses(pbf, out_addresses)
    print(f"addresses: {count:,} in {time.time() - started:.0f}s")


if __name__ == "__main__":
    main()
