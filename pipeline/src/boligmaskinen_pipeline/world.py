"""Build the small world layers drawn under the detailed Danish basemap.

The detailed Protomaps basemap only covers Denmark. Natural Earth (public domain, 1:50m)
fills in the rest of the world so the map can be panned and zoomed anywhere: land, large
lakes, country borders, and country and city names for the low zoom levels.

Usage:
    python -m boligmaskinen_pipeline world <out_dir> <zip>...

The zips are Natural Earth's ne_50m_land, ne_50m_lakes, ne_50m_admin_0_boundary_lines_land,
ne_50m_admin_0_countries and ne_50m_populated_places_simple, recognised by their names.
Writes <out_dir>/{land,lakes,boundaries,countries,places}.json.
"""

import argparse
import json
from pathlib import Path

import pyogrio
import shapely

from .progress import log, progress

PRECISION = 3  # decimal degrees, about 100 m, plenty for 1:50m data
NAMES = ["ne_50m_land", "ne_50m_lakes", "ne_50m_admin_0_boundary_lines_land", "ne_50m_admin_0_countries", "ne_50m_populated_places_simple"]


def write(path: Path, features: list[dict]) -> None:
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    log(f"{path.stat().st_size / 1e6:6.2f} MB  {path.name} ({len(features)} features)")


def feature(geometry, properties: dict | None = None) -> dict:
    rounded = shapely.set_precision(geometry, 10 ** -PRECISION)
    return {"type": "Feature", "properties": properties or {}, "geometry": json.loads(shapely.to_geojson(rounded))}


def build(zips: dict[str, Path], out: Path) -> None:
    missing = [name for name in NAMES if name not in zips]
    if missing:
        raise SystemExit(f"Missing Natural Earth files: {', '.join(missing)}")
    out.mkdir(parents=True, exist_ok=True)

    def read(name: str):
        return pyogrio.read_dataframe(f"zip://{zips[name]}")

    land = read("ne_50m_land")
    write(out / "land.json", [feature(g) for g in land.geometry if g is not None])
    progress(0.4)

    lakes = read("ne_50m_lakes")
    lakes = lakes[lakes["scalerank"] <= 3]  # the large lakes only
    write(out / "lakes.json", [feature(g) for g in lakes.geometry])

    borders = read("ne_50m_admin_0_boundary_lines_land")
    write(out / "boundaries.json", [feature(g) for g in borders.geometry])
    progress(0.7)

    countries = read("ne_50m_admin_0_countries")
    write(out / "countries.json", [
        feature(shapely.Point(row.LABEL_X, row.LABEL_Y), {"name": row.NAME, "rank": int(row.LABELRANK)})
        for row in countries.itertuples() if row.LABEL_X is not None
    ])

    places = read("ne_50m_populated_places_simple")
    places = places[places["scalerank"] <= 6].sort_values("pop_max", ascending=False)
    write(out / "places.json", [
        feature(g, {"name": name, "rank": int(rank), "capital": int(capital)})
        for g, name, rank, capital in zip(places.geometry, places["name"], places["scalerank"], places["adm0cap"])
    ])
    progress(1)


def cli(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="world", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("zips", type=Path, nargs="+")
    args = parser.parse_args(argv)
    build({path.name.removesuffix(".zip"): path for path in args.zips}, args.out_dir)
