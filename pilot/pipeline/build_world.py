"""Build the small world layers drawn under the detailed Danish basemap.

The detailed Protomaps basemap only covers Denmark. Natural Earth (public domain, 1:50m)
fills in the rest of the world so the map can be panned and zoomed anywhere: land, large
lakes, country borders, and country and city names for the low zoom levels.

Usage:
    python build_world.py <natural_earth_zip_dir> <site_dir>

Writes <site_dir>/world/{land,lakes,boundaries,countries,places}.json.
"""

import json
import sys
from pathlib import Path

import pyogrio
import shapely

PRECISION = 3  # decimal degrees, about 100 m, plenty for 1:50m data


def read(zip_dir: Path, name: str):
    return pyogrio.read_dataframe(f"zip://{zip_dir / f'{name}.zip'}")


def write(path: Path, features: list[dict]) -> None:
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":"), ensure_ascii=False))
    print(f"{path.stat().st_size / 1e6:6.2f} MB  {path.name} ({len(features)} features)")


def feature(geometry, properties: dict | None = None) -> dict:
    rounded = shapely.set_precision(geometry, 10 ** -PRECISION)
    return {"type": "Feature", "properties": properties or {}, "geometry": json.loads(shapely.to_geojson(rounded))}


def main() -> None:
    zip_dir, site = Path(sys.argv[1]), Path(sys.argv[2])
    out = site / "world"
    out.mkdir(parents=True, exist_ok=True)

    land = read(zip_dir, "ne_50m_land")
    write(out / "land.json", [feature(g) for g in land.geometry if g is not None])

    lakes = read(zip_dir, "ne_50m_lakes")
    lakes = lakes[lakes["scalerank"] <= 3]  # the large lakes only
    write(out / "lakes.json", [feature(g) for g in lakes.geometry])

    borders = read(zip_dir, "ne_50m_admin_0_boundary_lines_land")
    write(out / "boundaries.json", [feature(g) for g in borders.geometry])

    countries = read(zip_dir, "ne_50m_admin_0_countries")
    write(out / "countries.json", [
        feature(shapely.Point(row.LABEL_X, row.LABEL_Y), {"name": row.NAME, "rank": int(row.LABELRANK)})
        for row in countries.itertuples() if row.LABEL_X is not None
    ])

    places = read(zip_dir, "ne_50m_populated_places_simple")
    places = places[places["scalerank"] <= 6].sort_values("pop_max", ascending=False)
    write(out / "places.json", [
        feature(g, {"name": name, "rank": int(rank), "capital": int(capital)})
        for g, name, rank, capital in zip(places.geometry, places["name"], places["scalerank"], places["adm0cap"])
    ])


if __name__ == "__main__":
    main()
