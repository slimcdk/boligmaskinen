"""Small, made-up sources for two municipalities, so every step runs in seconds.

Everything is placed in EPSG:25832 around Aarhus: Aarhus Kommune (751) is the square from
(570000, 6215000) to (580000, 6225000) and Randers Kommune (730) the square north of it. East
of them is sea, inside the national boundary.
"""

import json
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import openpyxl
import pytest
from pyproj import Transformer
from shapely.geometry import LineString, Point, box

TO_LONLAT = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)

AARHUS = box(570_000, 6_215_000, 580_000, 6_225_000)
RANDERS = box(570_000, 6_225_000, 580_000, 6_235_000)
FOREST = box(572_000, 6_217_000, 573_000, 6_218_000)
BYZONE = box(573_500, 6_218_500, 574_500, 6_219_500)
SOMMERHUS = box(579_000, 6_215_000, 580_000, 6_216_000)
INDUSTRIAL = box(578_000, 6_218_000, 579_000, 6_219_000)
HOMES = [(573_850 + 50 * i, 6_218_850 + 50 * j) for i in range(6) for j in range(6)]
FACTORY_ADDRESSES = [(578_400, 6_218_400), (578_600, 6_218_400), (578_400, 6_218_600), (578_600, 6_218_600)]


def lonlat(x: float, y: float) -> tuple[float, float]:
    lon, lat = TO_LONLAT.transform(x, y)
    return float(lon), float(lat)


def frame(rows: list[dict]) -> gpd.GeoDataFrame:
    """Rows in EPSG:25832 as the OSM step writes them, in EPSG:4326."""
    return gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:25832").to_crs("EPSG:4326")


def jsonstat(dimensions: dict[str, list[str]], values: list[float]) -> dict:
    """A JSON-stat response as Statistikbanken's API gives it."""
    return {"dataset": {
        "dimension": {
            **{name: {"category": {"index": {code: i for i, code in enumerate(codes)}}} for name, codes in dimensions.items()},
            "id": list(dimensions), "size": [len(codes) for codes in dimensions.values()],
        },
        "value": values,
    }}


def write_shapefile_zip(path: Path, data: gpd.GeoDataFrame) -> None:
    """A zipped shapefile, as Natural Earth publishes them."""
    folder = path.parent / path.stem
    folder.mkdir()
    data.to_file(folder / f"{path.stem}.shp")
    with zipfile.ZipFile(path, "w") as archive:
        for member in sorted(folder.iterdir()):
            archive.write(member, member.name)


@pytest.fixture(scope="session")
def sources(tmp_path_factory) -> Path:
    """Every source the grid reads, with an inputs.json that names them."""
    root = tmp_path_factory.mktemp("sources")

    # --- OpenStreetMap, as the osm step writes it ---
    gpkg = root / "osm" / "layers.gpkg"
    gpkg.parent.mkdir()
    layers = {
        "municipality": [{"name": "Aarhus Kommune", "ref": "751", "geometry": AARHUS},
                         {"name": "Randers Kommune", "ref": "730", "geometry": RANDERS},
                         {"name": "Not a municipality", "ref": "", "geometry": box(560_000, 6_215_000, 565_000, 6_220_000)}],
        "country": [{"geometry": box(555_000, 6_200_000, 595_000, 6_250_000)}],
        "forest": [{"geometry": FOREST}, {"geometry": box(571_000, 6_216_000, 571_100, 6_216_100)}],  # the second is too small
        "water": [{"geometry": box(576_000, 6_220_000, 576_600, 6_220_600)}],
        "beach": [{"geometry": Point(579_900, 6_216_000)}],
        "supermarket": [{"name": "Netto", "geometry": Point(574_000, 6_219_000)}, {"name": "Rema", "geometry": Point(577_000, 6_223_000)}],
        "station": [{"name": "Aarhus H", "geometry": Point(575_000, 6_221_000)}],
        "industrial": [{"geometry": INDUSTRIAL}],
        "road": [{"road_class": "motorway", "geometry": LineString([(565_000, 6_222_000), (585_000, 6_222_000)])},
                 {"road_class": "secondary", "geometry": LineString([(574_000, 6_215_000), (574_000, 6_235_000)])}],
        "coastline": [{"geometry": LineString([(580_000, 6_215_000), (580_000, 6_235_000)])}],
    }
    for name, rows in layers.items():
        frame(rows).to_file(gpkg, layer=name, driver="GPKG")
    addresses = [lonlat(x, y) for x, y in HOMES + FACTORY_ADDRESSES]
    np.save(root / "osm" / "addresses.npy", np.array(addresses, dtype=np.float64))

    # --- Miljøstyrelsen's road noise: a band along the motorway ---
    noise = gpd.GeoDataFrame([
        {"category": "Lden6569", "source": "roadsInAgglomeration", "geometry": box(570_000, 6_221_900, 580_000, 6_222_100)},
        {"category": "Lden5559", "source": "majorRoads", "geometry": box(570_000, 6_221_700, 580_000, 6_221_900)},
    ], geometry="geometry", crs="EPSG:25832")
    (root / "mst").mkdir()
    noise.to_file(root / "mst" / "eu_2022_vej_4m.shp")
    # ...and a railway across the south of Aarhus, in the 60–64 dB band
    rail = gpd.GeoDataFrame([{"category": "Lden6064", "geometry": box(570_000, 6_217_950, 580_000, 6_218_050)}], geometry="geometry", crs="EPSG:25832")
    rail.to_file(root / "mst" / "eu_2022_jernbane_4m.shp")

    # --- Plandata's zone map: 1 is byzone, 3 sommerhusområde ---
    zones = gpd.GeoDataFrame([{"zone": 1, "geometry": BYZONE}, {"zone": 3, "geometry": SOMMERHUS}], geometry="geometry", crs="EPSG:25832")
    zones.to_file(root / "zonekort.geojson", driver="GeoJSON")

    # --- STIL: two schools that count, one closed and one of another kind; daycare units ---
    def institution(type_id: int, status: str, x: float, y: float) -> dict:
        lon, lat = lonlat(x, y)
        return {"institutionTypeId": type_id, "activeCodeName": status, "latitude": lat, "longitude": lon}

    institutions = [institution(1012, "Aktiv", 573_900, 6_219_100), institution(1013, "Aktiv", 576_000, 6_224_000),
                    institution(1012, "Ophørt", 575_500, 6_216_500), institution(1020, "Aktiv", 575_000, 6_218_000)]
    (root / "institutions.json").write_text(json.dumps(institutions), encoding="utf-8")
    lines = ["navn;aktivitetsstatus;geoBredde;geoLaengde"]
    for name, status, (x, y) in [("Solsikken", "Aktiv", (574_100, 6_218_900)), ("Mælkebøtten", "Aktiv", (577_500, 6_229_000)),
                                 ("Lukket", "Ophørt", (572_000, 6_222_000))]:
        lon, lat = lonlat(x, y)
        lines.append(f"{name};{status};{lat};{lon}")
    (root / "dagtilbud.csv").write_text("\n".join(lines) + "\n", encoding="utf-8-sig")

    # --- Energistyrelsen: data from the fourth row; column 4 is the decommissioning date, 14 and 15 the position ---
    book = openpyxl.Workbook()
    sheet = book.active
    for _ in range(3):
        sheet.append(["header"])
    sheet.append([1, "Mølle", None, None, *[None] * 9, "571000,0", "6234000,0"])
    sheet.append([2, "Mølle", None, "2020-01-01", *[None] * 9, 579_000, 6_224_000])
    book.save(root / "vinddata.xlsx")

    # --- Danmarks Statistik ---
    areas = ["000", "751", "730"]
    (root / "pskat.json").write_text(json.dumps(jsonstat({"OMRÅDE": areas, "SKATPCT": ["KOM", "GRUND"], "Tid": ["2026"]},
                                                         [25.0, 7.0, 24.52, 6.0, 25.4, 7.2])), encoding="utf-8")
    (root / "straf.json").write_text(json.dumps(jsonstat({"OMRÅDE": areas, "OVERTRÆD": ["1320"], "ANMSIGT": ["ANM"], "Tid": ["2025"]},
                                                         [5000, 1300, 300])), encoding="utf-8")
    (root / "folk.json").write_text(json.dumps(jsonstat({"OMRÅDE": areas, "KØN": ["TOT"], "ALDER": ["IALT"], "CIVILSTAND": ["TOT"], "Tid": ["2026K3"]},
                                                        [6_000_000, 378_270, 100_000])), encoding="utf-8")

    # --- DCE's air quality: 1 km squares over the two municipalities, NO₂ rising to the east ---
    squares = []
    for x in range(570_000, 580_000, 1000):
        for y in range(6_215_000, 6_235_000, 1000):
            squares.append({"NO2": 5 + (x - 570_000) / 1000, "PM2_5": 5.5, "geometry": box(x, y, x + 1000, y + 1000)})
    air = gpd.GeoDataFrame(squares, geometry="geometry", crs="EPSG:25832")
    air[["NO2", "geometry"]].to_file(root / "no2.geojson", driver="GeoJSON")
    air[["PM2_5", "geometry"]].to_file(root / "pm25.geojson", driver="GeoJSON")

    inputs = {
        "no2": "no2.geojson", "pm25": "pm25.geojson",
        "osm_layers": "osm/layers.gpkg", "osm_addresses": "osm/addresses.npy", "noise": "mst/eu_2022_vej_4m.shp", "noise_rail": "mst/eu_2022_jernbane_4m.shp",
        "zones": "zonekort.geojson", "institutions": "institutions.json", "daycare": "dagtilbud.csv", "turbines": "vinddata.xlsx",
        "tax": "pskat.json", "burglaries": "straf.json", "population": "folk.json",
    }
    (root / "inputs.json").write_text(json.dumps(inputs), encoding="utf-8")
    return root / "inputs.json"


@pytest.fixture(scope="session")
def natural_earth(tmp_path_factory) -> list[Path]:
    """Natural Earth's five zips, each with a feature or two."""
    root = tmp_path_factory.mktemp("natural-earth")
    lonlat_frame = lambda rows: gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:4326")  # noqa: E731
    data = {
        "ne_50m_land": lonlat_frame([{"featurecla": "Land", "geometry": box(8, 54.5, 15, 57.8)}]),
        "ne_50m_lakes": lonlat_frame([{"name": "Vänern", "scalerank": 1, "geometry": box(12.5, 58.5, 14, 59.3)},
                                      {"name": "Little", "scalerank": 6, "geometry": box(10, 56, 10.1, 56.1)}]),
        "ne_50m_admin_0_boundary_lines_land": lonlat_frame([{"name": "DK-DE", "geometry": LineString([(8.6, 54.9), (9.9, 54.8)])}]),
        "ne_50m_admin_0_countries": lonlat_frame([{"NAME": "Denmark", "LABELRANK": 4, "LABEL_X": 9.0185, "LABEL_Y": 55.9666,
                                                   "geometry": box(8, 54.5, 15, 57.8)}]),
        "ne_50m_populated_places_simple": lonlat_frame([
            {"name": "Copenhagen", "scalerank": 1, "adm0cap": 1, "pop_max": 1_085_000, "geometry": Point(12.56, 55.68)},
            {"name": "Aarhus", "scalerank": 4, "adm0cap": 0, "pop_max": 237_000, "geometry": Point(10.2, 56.16)},
            {"name": "Hamlet", "scalerank": 9, "adm0cap": 0, "pop_max": 100, "geometry": Point(10.5, 56.5)},
        ]),
    }
    paths = []
    for name, rows in data.items():
        path = root / f"{name}.zip"
        write_shapefile_zip(path, rows)
        paths.append(path)
    return paths
