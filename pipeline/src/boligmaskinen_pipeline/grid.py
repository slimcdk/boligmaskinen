"""Build the data layers of a region on a grid: all of Denmark, a few municipalities, or Aarhus for tests.

Every criterion becomes one 8-bit raster on a grid in EPSG:25832, aligned to Det Danske
Kvadratnet, with cells of --cell metres (100 by default). The rasters are then sampled onto a
Web Mercator display grid so the browser can draw them directly on the map, and written as
gzipped bytes. The display grid is 100 m for a region and 200 m for the whole country, so the
browser can hold every layer in memory, and never finer than the grid.

Usage:
    python -m boligmaskinen_pipeline grid <inputs.json> <out_dir> [--region denmark] [--cell 100] [--display 200]

<inputs.json> names the file of every source (relative paths are read from the JSON file's folder):

    osm_layers    layers.gpkg from the osm step        osm_addresses  addresses.npy from the osm step
                  (forests, lakes, beaches, solar parks, airfields, pharmacies, libraries, …)
    noise         eu_2022_vej_4m.shp (Miljøstyrelsen)  zones          zonekort.geojson (Plandata)
    noise_rail, noise_air, noise_industry  Miljøstyrelsen's maps of railways, airports and industry (optional)
    institutions  institutions.json (STIL)             daycare        dagtilbud CSV (STIL)
    turbines      vinddata.xlsx (Energistyrelsen)      tax, burglaries, population  PSKAT, STRAF22, FOLK1A (DST); income, nursery_price, class_size
                  INDKP101, RES88, KVOTIEN (DST, optional)
    no2, pm25     DCE's air quality on a 1 km grid, as GeoJSON (optional: without them the layers have no data)
    protected_areas, natura2000_habitats, natura2000_birds
                  Miljøstyrelsen's fredninger and Natura 2000 areas, as GeoJSON (optional: without them the
                  layers are left out)
    planned_traffic, planned_traffic_proposed
                  the traffic the municipal plans plan, adopted and proposed, from Plandata.dk (optional)
    local_plans_proposed, local_plans_adopted
                  the local plans of the last two years, proposed and adopted, from Plandata.dk (optional)
    supply_areas  the heat plans' supply areas, from Plandata.dk (optional)
    consequence_zones, consequence_zones_plants
                  the plans' zones around businesses and technical plants, from Plandata.dk (optional)
    raw_material_areas
                  the regions' raw material areas, from Danmarks Miljøportal (optional)
    transit       Rejseplanen's GTFS feed, for the departures near every cell (optional)
    water_hardness
                  GEUS's drinking water hardness per supply area: a GeoPackage, or a ZIP file with one (optional)
    forest_lines, church_lines, lake_lines, stream_lines
                  the building lines around forests, churches, lakes and streams, from Danmarks Miljøportal (optional)
    elevation     a list of the Copernicus elevation model's tiles (GLO-30 GeoTIFFs) over the region (optional)
    chargers      GeoFA's chargers for electric cars (theme 5607), as GeoJSON (optional: without it the chargers
                  come from the OSM extract alone)

The region is denmark, oestjylland, aarhus, or municipality codes such as 751,706.
<out_dir> gets a .u8.gz file per layer, meta.json, municipalities.json, chargers.json (the public chargers
for electric cars, whose distances the browser finds for the operators a block chooses) and
basemap-region.geojson, the outline the basemap has to cover.
"""

import argparse
import csv
import gzip
import json
import re
import tempfile
import time
import zipfile
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import geopandas as gpd
import numpy as np
import openpyxl
import pandas as pd
import pyogrio
import rasterio
import shapely
from pyproj import Transformer
from rasterio.features import rasterize
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject, transform_bounds
from scipy import ndimage

from . import transit
from .memory import release
from .progress import log, progress, warn

BUFFER = 10_000  # metres of context around the region, so distances near borders are right
DIST_MAX = 20_000  # metres; distances are stored with a square-root encoding up to this value

# What keeps a national build small in memory (#69):
# rasterio copies every vertex into Python objects before it burns them, so geometries are burned
# this many vertices at a time
BURN_VERTICES = 500_000
# Distances are worked out in blocks of this many cells a side, each with a margin of the farthest
# distance that matters, so they take the same memory for a town and for the whole country
DISTANCE_BLOCK = 1024

REGIONS = {
    "denmark": {"name": "Danmark", "codes": None},  # every municipality
    "oestjylland": {"name": "Østjylland", "codes": ["751", "730", "710", "740", "746", "615", "727", "766", "706", "707", "741"]},
    # A small region for the frontend's end-to-end tests (frontend/e2e/data-pack)
    "aarhus": {"name": "Aarhus Kommune", "codes": ["751"]},
}
CODES = re.compile(r"^\d{3}(,\d{3})*$")

INPUTS = ["osm_layers", "osm_addresses", "noise", "zones", "institutions", "daycare", "turbines", "tax", "burglaries", "population"]
# Sources a build can do without: their layers have no data then
OPTIONAL_INPUTS = ["income", "nursery_price", "class_size", "no2", "pm25", "noise_rail", "noise_air", "noise_industry", "protected_areas", "natura2000_habitats", "natura2000_birds",
                   "planned_traffic", "planned_traffic_proposed", "local_plans_proposed", "local_plans_adopted", "supply_areas",
                   "consequence_zones", "consequence_zones_plants", "raw_material_areas", "transit", "water_hardness",
                   "forest_lines", "church_lines", "lake_lines", "stream_lines", "elevation", "chargers"]
# Miljøstyrelsen's noise maps besides the roads', in the same bands
OTHER_NOISE = {"noise_rail": "railways", "noise_air": "airports", "noise_industry": "industry"}
# DCE's air quality: the GeoJSON property, and raw steps per µg/m³ (raw 0 is no data)
CONCENTRATIONS = {"no2": ("NO2", 4), "pm25": ("PM2_5", 10)}
# The distance to a wind turbine in its total heights (Danish rules keep 4 from a neighbour's home):
# raw 1 + heights × 10, so up to 25.4 heights; raw 0 is no data
TURBINE_HEIGHT_STEPS = 10
TURBINE_HEIGHTS_MAX = 25

ROAD_NOISE_AT_10M = {"motorway": 76.0, "trunk": 72.0, "primary": 69.0, "secondary": 65.0}
NOISE_FLOOR = 40.0
MST_BANDS = {"Lden5559": 57, "Lden6064": 62, "Lden6569": 67, "Lden7074": 72, "LdenGreaterThan75": 77}

LAYERS = ["forest", "water", "beach", "noise", "supermarket", "school", "daycare", "station", "departures", "pharmacy", "library", "turbine",
          "turbine_heights", "solar", "power_line", "airport", "airfield", "air_station", "protected_area", "natura2000", "building_line", "planned_road", "new_local_plan", "consequence_zone", "extraction_area", "extraction_interest", "district_heating", "density", "zone",
          "municipality", "no2", "pm25", "water_hardness", "elevation", "mask"]

# The status of a fredning or Natura 2000 area in force ("Gældende / Vedtaget"), not a proposal or a draft
IN_FORCE = 3
# A fredning of land ("Arealfredning"): landscapes and nature. The other kind, a kirkefredning, keeps the
# view of a church free, and there is one by almost every village, so it says little about a place
AREA_FREDNING = 1
# Of the traffic the municipal plans plan, the kinds that are roads (1) and railways (2); not the
# paths, corridors, stations, parking, ports and airports
PLANNED_ROADS = {"1", "2"}
# The regions' raw material areas: set aside for digging ("Råstofgraveområde"), or kept for digging
# later ("Råstofinteresseområde")
EXTRACTION_AREA = 1
EXTRACTION_INTEREST = 2
# The drinking water's hardness in °dH, in the public waterworks' supply areas: raw 1 + °dH × this,
# up to 50.8 °dH; raw 0 is no data, as where homes have wells of their own
HARDNESS_STEPS = 5
# The height above sea level in whole metres: raw 1 + metres - ELEVATION_MIN, so from -10 m (some land
# lies below the sea) to 244 m; raw 0 is no data, as at sea
ELEVATION_MIN = -10
# Who runs a public charger for electric cars, as a block can choose them: an id, and the names the
# sources give the operator once they are made plain (lower case, no punctuation, no company form).
# The rest are "other". E.ON's chargers are run by EV Infra Denmark, whose EVSE ids start with DK*EFC
CHARGER_OPERATORS = {
    "clever": ["clever"], "norlys": ["norlys"], "ok": ["ok"], "spirii": ["spirii"], "ewii": ["ewii"], "eon": ["e on", "eon", "ev infra"],
    "tesla": ["tesla"], "circle_k": ["circle k"], "uno_x": ["uno x"], "shell": ["shell"], "q8": ["q8"],
}
COMPANY_WORDS = re.compile(r"\b(a s|aps|a m b a|amba|i s|danmark|denmark|dk|mobility|motors|recharge|solutions|drive|infrastructure)\b")
# Chargers of one operator closer than this to each other are one site
CHARGER_SITE_M = 25
# GeoFA's chargers for cars ("Elladestander til bil"), not those of a municipality's own cars or a private one
CHARGER_KIND = "Elladestander til bil"
CHARGER_NOT_PUBLIC = {"Kommunal bilflåde", "Privat ladestander"}
# Public transport near a cell: the trips that leave a stop within DEPARTURES_M of it between
# DEPARTURES_FROM and DEPARTURES_TO on the timetable's weekday, per hour
DEPARTURES_M = 500
DEPARTURES_FROM = 7 * 3600
DEPARTURES_TO = 9 * 3600
# The heat plans' kind of supply area that is district heating ("Fjernvarme"); the others are
# individual natural gas, other, and areas to be decided
DISTRICT_HEATING = "1"


@dataclass(frozen=True)
class AreaSource:
    """A GeoJSON file of areas, by its key in inputs.json, and the ones a layer takes from it."""
    key: str
    # The attributes `keep` reads
    columns: list[str]
    keep: Callable[[gpd.GeoDataFrame], object] = lambda frame: True


@dataclass(frozen=True)
class AreaLayer:
    """A layer of the distance to areas, 0 inside one. Without all its sources it is left out, so a
    block that reads it says it has no data."""
    name: str
    sources: list[AreaSource]
    # What the log calls the areas
    what: str
    # Narrow areas, such as a planned road, count by every cell they touch; the others by the cells
    # whose centres they cover, and one smaller than a cell by the cell of a point inside it
    all_touched: bool = False


def in_force(frame: gpd.GeoDataFrame):
    return frame["Statuskode"] == IN_FORCE


AREA_LAYERS = [
    AreaLayer("protected_area", [AreaSource("protected_areas", ["Statuskode", "Fred_tkode"],
                                            lambda frame: in_force(frame) & (frame["Fred_tkode"] == AREA_FREDNING))],
              "Fredninger of land in force"),
    AreaLayer("natura2000", [AreaSource("natura2000_habitats", ["Statuskode"], in_force), AreaSource("natura2000_birds", ["Statuskode"], in_force)],
              "Natura 2000 areas in force"),
    AreaLayer("planned_road", [AreaSource(key, ["temaspkode"], lambda frame: frame["temaspkode"].astype(str).isin(PLANNED_ROADS))
                               for key in ("planned_traffic", "planned_traffic_proposed")],
              "Roads and railways the municipal plans lay out", all_touched=True),
    # The job fetches only those of the last two years
    AreaLayer("new_local_plan", [AreaSource("local_plans_proposed", []), AreaSource("local_plans_adopted", [])], "Local plans of the last two years"),
    AreaLayer("consequence_zone", [AreaSource("consequence_zones", []), AreaSource("consequence_zones_plants", [])],
              "Zones around businesses and plants"),
    AreaLayer("district_heating", [AreaSource("supply_areas", ["type1203"], lambda frame: frame["type1203"].astype(str) == DISTRICT_HEATING)],
              "District heating areas"),
    AreaLayer("extraction_area", [AreaSource("raw_material_areas", ["Statuskode", "Omr_tkode"],
                                             lambda frame: in_force(frame) & (frame["Omr_tkode"] == EXTRACTION_AREA))],
              "Raw material extraction areas in force"),
    # Building needs a dispensation inside them: 300 m from forests and churches, 150 m from lakes and streams
    AreaLayer("building_line", [AreaSource(key, ["Statuskode"], in_force) for key in ("forest_lines", "church_lines", "lake_lines", "stream_lines")],
              "Building lines around forests, churches, lakes and streams in force"),
    AreaLayer("extraction_interest", [AreaSource("raw_material_areas", ["Statuskode", "Omr_tkode"],
                                                 lambda frame: in_force(frame) & (frame["Omr_tkode"] == EXTRACTION_INTEREST))],
              "Raw material areas kept for later, in force"),
]

# The aerodrome layers, and the kinds of aerodrome each measures the distance to (osm.aerodrome_kind)
AERODROME_LAYERS = {"airport": {"airport"}, "air_station": {"air_station"}, "airfield": {"airport", "air_station", "airfield"}}
TILE = 256  # cells per side of a detail tile


class Grid:
    """A north-up raster grid in EPSG:25832 with square cells of `cell` metres."""

    def __init__(self, x0: float, y0: float, x1: float, y1: float, cell: int):
        self.cell = cell
        self.x0, self.y0 = np.floor(x0 / cell) * cell, np.floor(y0 / cell) * cell
        self.x1, self.y1 = np.ceil(x1 / cell) * cell, np.ceil(y1 / cell) * cell
        self.width = int((self.x1 - self.x0) / cell)
        self.height = int((self.y1 - self.y0) / cell)
        self.transform = from_origin(self.x0, self.y1, cell, cell)

    @property
    def shape(self) -> tuple[int, int]:
        return self.height, self.width

    def cells(self, metres: float) -> int:
        """A distance in whole cells, at least one."""
        return max(1, round(metres / self.cell))

    def burn(self, geometries, value=1, all_touched=False, dtype="uint8", fill=0, values=None) -> np.ndarray:
        """The cells of the geometries: `value`, or each geometry's own of `values`."""
        out = np.full(self.shape, fill, dtype=dtype)
        batch, vertices = [], 0
        for index, geom in enumerate(geometries):
            if geom is None or geom.is_empty:
                continue
            batch.append((geom, value if values is None else values[index]))
            vertices += shapely.get_num_coordinates(geom)
            if vertices >= BURN_VERTICES:
                rasterize(batch, out=out, transform=self.transform, all_touched=all_touched)
                batch, vertices = [], 0
        if batch:
            rasterize(batch, out=out, transform=self.transform, all_touched=all_touched)
        return out

    def burn_points(self, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
        counts = np.zeros(self.shape, dtype=np.int32)
        cols = ((np.asarray(xs) - self.x0) // self.cell).astype(np.int64)
        rows = ((self.y1 - np.asarray(ys)) // self.cell).astype(np.int64)
        inside = (cols >= 0) & (cols < self.width) & (rows >= 0) & (rows < self.height)
        np.add.at(counts, (rows[inside], cols[inside]), 1)
        return counts

    def distance_to(self, mask: np.ndarray, limit: float = DIST_MAX) -> np.ndarray:
        """Distance in metres from every cell to the nearest cell where mask is true.

        It is exact up to `limit`; farther away it is more than `limit`, or infinite. Each block of
        cells looks only as far as `limit` around it, which is where its nearest cell is when it
        is that near. The distances are worked out from the nearest cells as SciPy does, in whole
        cells, but for the block alone: the same values in a third of the memory.
        """
        out = np.full(self.shape, np.inf, dtype=np.float32)
        mask = mask.astype(bool, copy=False)
        margin = int(np.ceil(limit / self.cell)) + 1
        height, width = self.shape
        for r0 in range(0, height, DISTANCE_BLOCK):
            for c0 in range(0, width, DISTANCE_BLOCK):
                r1, c1 = min(r0 + DISTANCE_BLOCK, height), min(c0 + DISTANCE_BLOCK, width)
                wr0, wc0 = max(0, r0 - margin), max(0, c0 - margin)
                window = mask[wr0:min(height, r1 + margin), wc0:min(width, c1 + margin)]
                if not window.any():
                    continue
                nearest = ndimage.distance_transform_edt(~window, return_distances=False, return_indices=True)
                rows, cols = nearest[:, r0 - wr0:r1 - wr0, c0 - wc0:c1 - wc0].astype(np.int64)
                del nearest
                rows -= np.arange(r0 - wr0, r1 - wr0)[:, None]
                cols -= np.arange(c0 - wc0, c1 - wc0)[None, :]
                out[r0:r1, c0:c1] = np.sqrt(rows * rows + cols * cols) * self.cell
        return out


def to_utm(frame: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    return frame.to_crs("EPSG:25832")


def points_utm(lons, lats) -> tuple[np.ndarray, np.ndarray]:
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True)
    return transformer.transform(np.asarray(lons, dtype=float), np.asarray(lats, dtype=float))


def encode_distance(metres: np.ndarray) -> np.ndarray:
    clipped = np.clip(metres, 0, DIST_MAX) / DIST_MAX
    return np.round(np.sqrt(clipped) * 255).astype(np.uint8)


def jsonstat_values(path: Path) -> dict[str, float]:
    """Read a single-measure JSON-stat response into {area code: value}."""
    dataset = json.loads(path.read_text(encoding="utf-8"))["dataset"]
    areas = dataset["dimension"]["OMRÅDE"]["category"]["index"]
    values = dataset["value"]
    sizes = dataset["dimension"]["size"]
    stride = int(np.prod(sizes[1:]))
    return {code: values[index * stride] for code, index in areas.items()}


def read_zipped(path: Path, suffix: str = ".gpkg") -> gpd.GeoDataFrame:
    """A layer of a file, or of the first file with `suffix` inside a ZIP file."""
    if path.suffix.lower() != ".zip":
        return gpd.read_file(path)
    with zipfile.ZipFile(path) as archive:
        member = next((name for name in archive.namelist() if name.lower().endswith(suffix)), None)
    if member is None:
        raise SystemExit(f"{path} has no {suffix} file")
    return gpd.read_file(f"/vsizip/{path}/{member}")


def water_hardness(grid: "Grid", source: Path) -> tuple[np.ndarray, int]:
    """The hardness of the drinking water in every cell of a supply area (GEUS), as raw 1 + °dH ×
    HARDNESS_STEPS; 0 elsewhere. Returns the layer and the number of areas."""
    areas = read_zipped(source).set_crs("EPSG:25832", allow_override=True)
    raw = np.clip(np.round(1 + pd.to_numeric(areas["Hardness_d"], errors="coerce").fillna(-1).to_numpy() * HARDNESS_STEPS), 0, 255).astype(np.uint8)
    return grid.burn(areas.geometry.to_list(), values=raw), len(areas)


def elevation(grid: "Grid", tiles: list[Path]) -> np.ndarray:
    """The height above sea level of every cell, as raw 1 + metres - ELEVATION_MIN, from the tiles of the
    Copernicus elevation model (GLO-30, about 30 m).

    The model is of the surface, roofs and treetops too, so a cell takes the first quartile of the
    model's points in it: between houses that is mostly the ground, while a forest's treetops may
    still lift it. The model gives the sea a height of 0, which is left out, so a cell on the coast
    has the height of its land; a cell all at sea has no data (raw 0).
    """
    heights = np.full(grid.shape, np.nan, dtype=np.float32)
    # GDAL keeps up to 5 % of the machine's memory of blocks it has read, more than a container may have
    for tile in tiles:
        with rasterio.Env(GDAL_CACHEMAX=64), rasterio.open(tile) as src:
            # The cells the tile covers, and a little more: its edge is warped too
            left, bottom, right, top = transform_bounds(src.crs, "EPSG:25832", *src.bounds)
            c0, c1 = max(0, int((left - grid.x0) // grid.cell)), min(grid.width, int(np.ceil((right - grid.x0) / grid.cell)) + 1)
            r0, r1 = max(0, int((grid.y1 - top) // grid.cell)), min(grid.height, int(np.ceil((grid.y1 - bottom) / grid.cell)) + 1)
            if c0 >= c1 or r0 >= r1:
                continue
            window = np.full((r1 - r0, c1 - c0), np.nan, dtype=np.float32)
            reproject(source=src.read(1), destination=window, src_transform=src.transform, src_crs=src.crs, src_nodata=0,
                      dst_transform=from_origin(grid.x0 + c0 * grid.cell, grid.y1 - r0 * grid.cell, grid.cell, grid.cell),
                      dst_crs="EPSG:25832", dst_nodata=np.nan, resampling=Resampling.q1)
        # Tiles meet at their edges, where each has a part of a cell: the lower holds, as within a cell
        heights[r0:r1, c0:c1] = np.fmin(heights[r0:r1, c0:c1], window)
        del window
    raw = np.clip(np.round(heights - ELEVATION_MIN) + 1, 1, 255)
    return np.where(np.isnan(heights), 0, raw).astype(np.uint8)


def charger_operator(name: str | None) -> str:
    """The id of a charger's operator in CHARGER_OPERATORS, or "other"."""
    plain = re.sub(r"[^0-9a-zæøå]+", " ", (name or "").lower())
    plain = " ".join(COMPANY_WORDS.sub(" ", plain).split())
    for operator, names in CHARGER_OPERATORS.items():
        if any(plain == known or plain.startswith(known + " ") for known in names):
            return operator
    return "other"


def chargers(grid: "Grid", gpkg: Path, geofa: Path | None) -> tuple[dict, dict[str, int]]:
    """The public chargers for electric cars on the grid, one point per operator and site, as the
    browser reads them: {"operators": [id, …], "points": [[lon, lat, index of the operator], …]};
    and how many chargers each source gave, on the grid. A source that is not there has no count, so
    the pack check sees a new count when it comes, not a jump from 0: GeoFA, or an OSM extract taken
    out before it had chargers.

    GeoFA has those the operators report, nearly all; the OSM extract has some that GeoFA lacks, such
    as Tesla's, Circle K's and Shell's. A site in both counts once for each, which changes no distance.
    """
    xs, ys, names, sources = [], [], [], []
    present = []
    if geofa:
        present.append("geofa")
        points = gpd.read_file(geofa)
        points = points[(points["ladefacilitet_type"] == CHARGER_KIND) & (pd.to_numeric(points["statuskode"], errors="coerce") == IN_FORCE)
                        & (points["planstatus"] != "Planlagt") & ~points["tilgaengelighed_type"].isin(CHARGER_NOT_PUBLIC)]
        # A charger is a MultiPoint, nearly always of one point
        points = points.set_crs("EPSG:25832", allow_override=True).explode(index_parts=False).reset_index(drop=True)
        operator = points["operatoer_ladefacilitet"].fillna("")
        xs.append(points.geometry.x.to_numpy())
        ys.append(points.geometry.y.to_numpy())
        names += operator.where(operator != "", points["ejer_ladefacilitet"].fillna("")).tolist()
        sources += ["geofa"] * len(points)
    if "charger" in {name for name, _ in pyogrio.list_layers(gpkg)}:
        present.append("osm")
    osm = read_layer(gpkg, "charger")
    if len(osm):
        centres = osm.geometry.representative_point()
        xs.append(centres.x.to_numpy())
        ys.append(centres.y.to_numpy())
        names += osm["operator"].fillna("").tolist()
        sources += ["osm"] * len(osm)
    ids = list(CHARGER_OPERATORS) + ["other"]
    keys = {"geofa": "chargersGeofa", "osm": "chargersOsm"}
    if not names:
        return {"operators": ids, "points": []}, {keys[source]: 0 for source in present}
    x, y = np.concatenate(xs), np.concatenate(ys)
    index = np.array([ids.index(charger_operator(name)) for name in names], dtype=np.int64)
    inside = (x >= grid.x0) & (x < grid.x1) & (y >= grid.y0) & (y < grid.y1)
    from_source = np.array(sources)[inside]
    counts = {keys[source]: int((from_source == source).sum()) for source in present}
    sites = pd.DataFrame({"operator": index, "x": x, "y": y})[inside]
    sites = sites.loc[~sites.assign(cx=(sites["x"] // CHARGER_SITE_M), cy=(sites["y"] // CHARGER_SITE_M)).duplicated(["operator", "cx", "cy"])]
    lon, lat = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True).transform(sites["x"].to_numpy(), sites["y"].to_numpy())
    order = np.lexsort((np.round(lat, 5), np.round(lon, 5), sites["operator"].to_numpy()))
    return {"operators": ids, "points": [[round(float(lon[i]), 5), round(float(lat[i]), 5), int(sites["operator"].iloc[i])] for i in order]}, counts


def departures_per_hour(grid: "Grid", feed: Path) -> tuple[np.ndarray, int]:
    """Departures per hour from the stops within DEPARTURES_M of every cell, between DEPARTURES_FROM and
    DEPARTURES_TO on the feed's weekday: each trip once, however many of its stops are near (255 for
    255 or more). Returns the layer, and how many trips leave a stop then."""
    day = transit.read_day(feed)
    trip, stop, departure = day.times[:, 0], day.times[:, 2], day.times[:, 4]
    # A trip leaves every stop but its last
    leaves = np.zeros(len(trip), dtype=bool)
    leaves[:-1] = trip[1:] == trip[:-1]
    keep = leaves & (departure >= DEPARTURES_FROM) & (departure < DEPARTURES_TO)
    trip, stop = trip[keep], stop[keep]
    cols = ((day.stop_xy[:, 0] - grid.x0) // grid.cell).astype(np.int64)
    rows = ((grid.y1 - day.stop_xy[:, 1]) // grid.cell).astype(np.int64)
    radius = grid.cells(DEPARTURES_M)
    dr, dc = np.mgrid[-radius:radius + 1, -radius:radius + 1]
    disk = dr ** 2 + dc ** 2 <= radius ** 2
    dr, dc = dr[disk], dc[disk]
    counts = np.zeros(grid.shape, dtype=np.int32)
    firsts = np.flatnonzero(np.r_[True, trip[1:] != trip[:-1]]) if len(trip) else np.zeros(0, dtype=np.int64)
    for first, end in zip(firsts, np.r_[firsts[1:], len(trip)]):
        r = (rows[stop[first:end]][:, None] + dr).ravel()
        c = (cols[stop[first:end]][:, None] + dc).ravel()
        inside = (r >= 0) & (r < grid.height) & (c >= 0) & (c < grid.width)
        counts.flat[np.unique(r[inside] * grid.width + c[inside])] += 1
    hours = (DEPARTURES_TO - DEPARTURES_FROM) / 3600
    return np.clip(np.round(counts / hours), 0, 255).astype(np.uint8), len(firsts)


def area_cells(grid: "Grid", source: Path, area: AreaSource, all_touched: bool) -> tuple[np.ndarray, int]:
    """The cells of the areas of a file that `area` keeps, and how many it keeps."""
    frame = gpd.read_file(source, columns=area.columns)
    frame = frame.to_crs("EPSG:25832") if frame.crs else frame.set_crs("EPSG:25832")
    kept = frame.geometry.notna() & ~frame.geometry.is_empty
    frame = frame[kept & area.keep(frame)]
    cells = grid.burn(frame.geometry, all_touched=all_touched).astype(bool)
    if not all_touched:
        inner = frame.geometry.representative_point()
        cells |= grid.burn_points(inner.x.to_numpy(), inner.y.to_numpy()) > 0
    return cells, len(frame)


def jsonstat_newest(path: Path) -> tuple[str, dict[str, float]]:
    """Read a single-measure JSON-stat response of one or more periods into the newest period with
    numbers, and its {area code: value}: Statistikbanken lists a year before it has its numbers,
    with zeros."""
    dataset = json.loads(path.read_text(encoding="utf-8"))["dataset"]
    dims = dataset["dimension"]
    sizes = dims["size"]
    strides = [int(np.prod(sizes[i + 1:])) for i in range(len(sizes))]
    area_stride, period_stride = strides[dims["id"].index("OMRÅDE")], strides[dims["id"].index("Tid")]
    areas, periods, values = dims["OMRÅDE"]["category"]["index"], dims["Tid"]["category"]["index"], dataset["value"]
    for period in sorted(periods, reverse=True):
        found = {code: values[i * area_stride + periods[period] * period_stride] for code, i in areas.items()}
        if any(found.values()):
            return period, found
    raise ValueError(f"{path.name} has no period with numbers")


def jsonstat_matrix(path: Path, dim: str) -> dict[str, dict[str, float]]:
    """Read a JSON-stat response with OMRÅDE x <dim> into {area: {dim value: value}}."""
    dataset = json.loads(path.read_text(encoding="utf-8"))["dataset"]
    areas = dataset["dimension"]["OMRÅDE"]["category"]["index"]
    others = dataset["dimension"][dim]["category"]["index"]
    values = dataset["value"]
    return {a: {o: values[ai * len(others) + oi] for o, oi in others.items()} for a, ai in areas.items()}


def concentration(grid: "Grid", source: Path | None, prop: str, steps: int) -> np.ndarray:
    """A layer of yearly means from squares of 1 km: raw 1 + value × steps, 0 where there is none."""
    if source is None:
        warn(f"No source for {prop}: its layer has no data")
        return np.zeros(grid.shape, dtype=np.uint8)
    squares = gpd.read_file(source).set_crs("EPSG:25832", allow_override=True)
    km = 1000
    bounds = squares.geometry.bounds
    kx = np.floor(bounds["minx"].to_numpy() / km).astype(np.int64)
    ky = np.floor(bounds["miny"].to_numpy() / km).astype(np.int64)
    values = np.clip(np.round(1 + squares[prop].to_numpy(dtype=float) * steps), 1, 255)
    x0, y0 = kx.min(), ky.min()
    table = np.zeros((ky.max() - y0 + 1, kx.max() - x0 + 1), dtype=np.uint8)
    table[ky - y0, kx - x0] = values.astype(np.uint8)
    # The square of every cell's centre
    cx = np.floor((grid.x0 + (np.arange(grid.width) + 0.5) * grid.cell) / km).astype(np.int64) - x0
    cy = np.floor((grid.y1 - (np.arange(grid.height) + 0.5) * grid.cell) / km).astype(np.int64) - y0
    inside_x = (cx >= 0) & (cx < table.shape[1])
    inside_y = (cy >= 0) & (cy < table.shape[0])
    layer = table[np.clip(cy, 0, table.shape[0] - 1)[:, None], np.clip(cx, 0, table.shape[1] - 1)[None, :]]
    return np.where(inside_y[:, None] & inside_x[None, :], layer, 0).astype(np.uint8)


def in_heights(grid: "Grid", xs: np.ndarray, ys: np.ndarray, heights: np.ndarray) -> np.ndarray:
    """The distance to the nearest turbine in its total heights, as a layer: raw 1 + heights × 10.

    The turbines are taken 10 m of height at a time, each group in the heights of its tallest, so
    a turbine never counts as farther away than it is, and the distance transform runs once a group.
    """
    known = ~np.isnan(heights)
    xs, ys, heights = xs[known], ys[known], np.maximum(heights[known], 5.0)
    nearest = np.full(grid.shape, np.inf, dtype=np.float32)
    for top in np.unique(np.ceil(heights / 10) * 10):
        group = (heights > top - 10) & (heights <= top)
        distance = grid.distance_to(grid.burn_points(xs[group], ys[group]) > 0, limit=TURBINE_HEIGHTS_MAX * top)
        distance /= top
        np.minimum(nearest, distance, out=nearest)
        del distance
    raw = np.clip(np.round(1 + nearest * TURBINE_HEIGHT_STEPS), 1, 255)
    return np.where(np.isfinite(nearest), raw, 255).astype(np.uint8)


def read_inputs(path: Path) -> dict[str, Path | list[Path]]:
    """The source files named in inputs.json, a file or a list of files each; every one has to be there."""
    named = json.loads(path.read_text(encoding="utf-8"))
    missing = [key for key in INPUTS if key not in named]
    if missing:
        raise SystemExit(f"{path} does not name: {', '.join(missing)}")

    def resolve(value: str | list[str]) -> Path | list[Path]:
        return [resolve(item) for item in value] if isinstance(value, list) else (path.parent / value).resolve()

    files = {key: resolve(named[key]) for key in INPUTS + OPTIONAL_INPUTS if key in named}
    absent = [f"{key} ({file})" for key, value in files.items() for file in (value if isinstance(value, list) else [value]) if not file.exists()]
    if absent:
        raise SystemExit(f"Missing source files: {', '.join(absent)}")
    return files


def read_layer(gpkg: Path, layer: str) -> gpd.GeoDataFrame:
    """A layer of the OSM extract, or an empty one when the extract has none."""
    if layer not in {name for name, _ in pyogrio.list_layers(gpkg)}:
        warn(f"The OSM extract has no {layer} layer")
        return gpd.GeoDataFrame(geometry=[], crs="EPSG:25832")
    return to_utm(pyogrio.read_dataframe(gpkg, layer=layer))


def read_chunks(path: Path, chunk: int, **options) -> Iterator[gpd.GeoDataFrame]:
    """A file's features a chunk at a time, so a big layer never has to be in memory at once."""
    start = 0
    while not (frame := pyogrio.read_dataframe(path, skip_features=start, max_features=chunk, **options)).empty:
        yield frame
        start += chunk


def large_areas(gpkg: Path, layer: str, minimum: float) -> Iterator:
    """The areas of an OSM layer of at least `minimum` m², in EPSG:25832, a chunk at a time."""
    if layer not in {name for name, _ in pyogrio.list_layers(gpkg)}:
        warn(f"The OSM extract has no {layer} layer")
        return
    for frame in read_chunks(gpkg, 20_000, layer=layer, columns=[]):
        frame = to_utm(frame)
        yield from frame.geometry[frame.area >= minimum]


class ParkedLayers(dict):
    """The finished layers, each on disk in $TMPDIR and read back as a memory map until the display
    grid and the detail tiles are written. Their pages are the files', which the kernel can drop and
    read again, so twenty layers of all of Denmark do not add 400 MB to the step's memory."""

    def __init__(self):
        super().__init__()
        self.folder = tempfile.TemporaryDirectory(prefix="grid-layers-")

    def __setitem__(self, name: str, layer: np.ndarray) -> None:
        path = Path(self.folder.name) / f"{name}.npy"
        np.save(path, layer)
        super().__setitem__(name, np.load(path, mmap_mode="r"))

    def close(self) -> None:
        self.clear()
        self.folder.cleanup()


def region_spec(region: str) -> dict:
    """A named region, or the municipalities whose codes are listed."""
    if region in REGIONS:
        return REGIONS[region]
    if CODES.match(region):
        return {"name": None, "codes": region.split(",")}
    raise SystemExit(f"The region has to be one of {', '.join(REGIONS)}, or municipality codes such as 751,706, not {region!r}")


def build(inputs: dict[str, Path | list[Path]], out: Path, region_id: str = "denmark", cell: int = 100, display: int | None = None) -> dict:
    """Build every layer of the region into `out`; returns meta.json's content."""
    spec = region_spec(region_id)
    display = max(cell, display or (200 if region_id == "denmark" else 100))
    out.mkdir(parents=True, exist_ok=True)
    gpkg = inputs["osm_layers"]
    started = time.time()

    def step(message: str, fraction: float) -> None:
        release()
        log(f"[{time.time() - started:6.1f} s] {message}")
        progress(fraction)

    # --- Municipalities, land and sea ---------------------------------------------------------
    # OSM's Danish municipalities follow the coastline and carry the municipality code in "ref",
    # so together they are the land, and the code links them to Danmarks Statistik.
    municipalities = read_layer(gpkg, "municipality")
    municipalities = municipalities[municipalities["ref"].str.fullmatch(r"\d{3}")].sort_values("ref")
    codes = spec["codes"] or list(municipalities["ref"])
    rows = []
    for index, code in enumerate(codes, start=1):
        match = municipalities[municipalities["ref"] == code]
        if match.empty:
            raise SystemExit(f"Municipality {code} is not in the OSM extract")
        name = match["name"].iloc[0].removesuffix(" Kommune").removesuffix(" Regionskommune")
        rows.append({"index": index, "code": code, "name": name, "geometry": match.geometry.union_all()})
    if len(rows) > 255:
        raise SystemExit("A region can have at most 255 municipalities")
    region = gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:25832")
    region_name = spec["name"] or (", ".join(region["name"]) if len(region) <= 3 else f"{len(region)} municipalities")
    rx0, ry0, rx1, ry1 = region.total_bounds
    grid = Grid(rx0 - BUFFER, ry0 - BUFFER, rx1 + BUFFER, ry1 + BUFFER, cell)
    step(f"{region_name}: {len(region)} municipalities; grid {grid.width} × {grid.height} cells of {cell} m "
         f"({grid.width * grid.height / 1e6:.1f} M)", 0.05)

    # The municipal outlines for the map, and the area the detailed basemap has to cover, while
    # little else is in memory
    outlines = region[["index", "name", "geometry"]].copy()
    outlines["geometry"] = outlines.geometry.simplify(display * 0.4)
    outlines.to_crs("EPSG:4326").to_file(out / "municipalities.json", driver="GeoJSON", COORDINATE_PRECISION=5)
    # Simplified before it is buffered: a buffer around every bend of the coast took gigabytes
    coverage = gpd.GeoSeries([region.geometry.simplify(100).union_all().buffer(3_000).simplify(500)], crs="EPSG:25832")
    coverage.to_crs("EPSG:4326").to_file(out / "basemap-region.geojson", driver="GeoJSON", COORDINATE_PRECISION=4)
    del outlines, coverage

    municipality_index = np.zeros(grid.shape, dtype=np.uint8)
    for row in region.itertuples():
        municipality_index = np.maximum(municipality_index, grid.burn([row.geometry], value=row.index))
    land = grid.burn(municipalities.geometry).astype(bool)
    del municipalities
    # The national boundary includes the territorial sea; what is inside it and not land is sea.
    # (The coastline alone cannot tell: the extract has almost no German or Swedish coast.)
    territory = grid.burn(read_layer(gpkg, "country").geometry).astype(bool)
    sea = territory & ~land
    del territory

    # --- Nature ------------------------------------------------------------------------------
    layers = ParkedLayers()
    layers["forest"] = encode_distance(grid.distance_to(grid.burn(large_areas(gpkg, "forest", 50_000))))  # woods of at least 5 ha
    lakes = grid.burn(large_areas(gpkg, "water", 50_000)).astype(bool)  # lakes of at least 5 ha
    layers["water"] = encode_distance(grid.distance_to(lakes | sea))
    del sea

    beach = read_layer(gpkg, "beach")
    layers["beach"] = encode_distance(grid.distance_to(grid.burn(beach.geometry, all_touched=True).astype(bool)))
    del beach
    region_land = (municipality_index > 0) & ~lakes
    del lakes
    step(f"Nature distances done; land cells in the region: {region_land.sum():,} "
         f"({region_land.sum() * cell * cell / 1e6:,.0f} km²)", 0.2)

    # --- Everyday services -------------------------------------------------------------------
    supermarkets = read_layer(gpkg, "supermarket")
    sx, sy = supermarkets.geometry.centroid.x.to_numpy(), supermarkets.geometry.centroid.y.to_numpy()
    layers["supermarket"] = encode_distance(grid.distance_to(grid.burn_points(sx, sy) > 0))

    stations = read_layer(gpkg, "station")
    tx, ty = stations.geometry.centroid.x.to_numpy(), stations.geometry.centroid.y.to_numpy()
    layers["station"] = encode_distance(grid.distance_to(grid.burn_points(tx, ty) > 0))

    institutions = json.loads(inputs["institutions"].read_text(encoding="utf-8"))
    schools = [i for i in institutions
               if i["institutionTypeId"] in (1012, 1013)
               and (i.get("activeCodeName") or "").startswith("Aktiv")
               and i.get("latitude") and i.get("longitude")]
    cx, cy = points_utm([s["longitude"] for s in schools], [s["latitude"] for s in schools])
    layers["school"] = encode_distance(grid.distance_to(grid.burn_points(cx, cy) > 0))

    with open(inputs["daycare"], encoding="utf-8-sig", newline="") as handle:
        daycare = [r for r in csv.DictReader(handle, delimiter=";")
                   if r["aktivitetsstatus"] == "Aktiv" and r["geoBredde"] and r["geoLaengde"]]
    dx, dy = points_utm([float(r["geoLaengde"]) for r in daycare], [float(r["geoBredde"]) for r in daycare])
    layers["daycare"] = encode_distance(grid.distance_to(grid.burn_points(dx, dy) > 0))
    found = {"supermarkets": len(supermarkets), "stations": len(stations), "schools": len(schools), "daycare": len(daycare)}
    del supermarkets, stations, institutions, schools, daycare

    # Pharmacies and public libraries (OpenStreetMap), from the point or the middle of the building
    for name, counted in (("pharmacy", "pharmacies"), ("library", "libraries")):
        places = read_layer(gpkg, name)
        middle = places.geometry.centroid
        layers[name] = encode_distance(grid.distance_to(grid.burn_points(middle.x.to_numpy(), middle.y.to_numpy()) > 0))
        found[counted] = len(places)
        del places, middle
    step(f"Services: {found['supermarkets']:,} supermarkets, {found['stations']:,} stations, "
         f"{found['schools']:,} schools, {found['daycare']:,} daycare units, {found['pharmacies']:,} pharmacies, "
         f"{found['libraries']:,} libraries", 0.35)

    # --- Wind turbines (Energistyrelsen) -------------------------------------------------------
    sheet = openpyxl.load_workbook(inputs["turbines"], read_only=True, data_only=True).worksheets[0]
    turbine_x, turbine_y, turbine_height = [], [], []
    number = lambda value: float(str(value).replace(",", ".")) if value not in (None, "") else float("nan")  # noqa: E731
    for values in sheet.iter_rows(min_row=4, values_only=True):
        decommissioned, x, y = values[3], values[13], values[14]
        if decommissioned or not x or not y:
            continue
        turbine_x.append(number(x))
        turbine_y.append(number(y))
        # The total height: the hub's and half the rotor (columns 6 and 5, in metres)
        turbine_height.append(number(values[6]) + number(values[5]) / 2)
    turbine_x, turbine_y, turbine_height = np.array(turbine_x), np.array(turbine_y), np.array(turbine_height)
    layers["turbine"] = encode_distance(grid.distance_to(grid.burn_points(turbine_x, turbine_y) > 0))
    layers["turbine_heights"] = in_heights(grid, turbine_x, turbine_y, turbine_height)
    found["turbines"] = len(turbine_x)
    unknown = int(np.isnan(turbine_height).sum())
    del sheet, turbine_x, turbine_y, turbine_height
    step(f"Wind turbines in operation: {found['turbines']:,}; {unknown} without a height, which count as distance only", 0.4)

    # --- Solar parks (OpenStreetMap): plants and panels on the ground of at least 1 ha ------------
    solar = grid.burn(large_areas(gpkg, "solar", 10_000), all_touched=True).astype(bool)
    layers["solar"] = encode_distance(grid.distance_to(solar))
    step(f"Solar parks cover {solar.sum() * cell * cell / 1e4:,.0f} ha of cells", 0.42)
    del solar

    # --- Overhead power lines of 132 kV or more (OpenStreetMap) --------------------------------
    lines = read_layer(gpkg, "power_line")
    layers["power_line"] = encode_distance(grid.distance_to(grid.burn(lines.geometry, all_touched=True).astype(bool)))
    step(f"Power lines: {lines.length.sum() / 1000:,.0f} km overhead at 132 kV or more", 0.425)
    del lines

    # --- Airports, air stations and every other airfield (OpenStreetMap) ----------------------
    aerodromes = read_layer(gpkg, "aerodrome")
    kinds = aerodromes["kind"].to_numpy() if "kind" in aerodromes.columns else np.array([], dtype=str)
    for name, wanted in AERODROME_LAYERS.items():
        chosen = aerodromes.geometry[np.isin(kinds, list(wanted))]
        points = (chosen.geom_type == "Point").to_numpy()
        # An aerodrome mapped as an area counts from its edge; one mapped as a point, from the point
        mask = grid.burn(chosen[~points], all_touched=True).astype(bool)
        mask |= grid.burn_points(chosen[points].x.to_numpy(), chosen[points].y.to_numpy()) > 0
        layers[name] = encode_distance(grid.distance_to(mask))
    counted = {kind: int((kinds == kind).sum()) for kind in ("airport", "air_station", "airfield")}
    step(f"Aerodromes: {counted['airport']} airports, {counted['air_station']} air stations and "
         f"{counted['airfield']} other airfields", 0.43)
    del aerodromes, kinds, chosen, mask

    # --- Areas: protected areas and Natura 2000, and what the plans and heat plans lay out --------
    for layer in AREA_LAYERS:
        if not all(inputs.get(area.key) for area in layer.sources):
            warn(f"No source for {layer.name}: the layer is left out")
            continue
        cells, count = np.zeros(grid.shape, dtype=bool), 0
        for area in layer.sources:
            kept, kept_count = area_cells(grid, inputs[area.key], area, layer.all_touched)
            cells |= kept
            count += kept_count
        layers[layer.name] = encode_distance(grid.distance_to(cells))
        step(f"{layer.what}: {count:,} cover {cells.sum() * cell * cell / 1e4:,.0f} ha of cells", 0.44)
        del cells, kept

    # --- Public transport: departures near every cell (Rejseplanen) ----------------------------
    if inputs.get("transit"):
        layers["departures"], trips = departures_per_hour(grid, inputs["transit"])
        step(f"Public transport: {trips:,} trips leave a stop between 7 and 9", 0.445)
    else:
        warn("No source for departures: the layer is left out")

    # --- Planning zones (Plandata) -----------------------------------------------------------
    zones = gpd.read_file(inputs["zones"])
    zones = zones.set_crs("EPSG:25832", allow_override=True)
    byzone = grid.burn(zones[zones["zone"] == 1].geometry).astype(bool)
    zone = np.where(land, 2, 0).astype(np.uint8)  # 2 = landzone unless mapped otherwise
    zone = np.where(byzone & land, 1, zone)
    zone = np.where(grid.burn(zones[zones["zone"] == 3].geometry).astype(bool) & land, 3, zone)
    layers["zone"] = zone
    del land, zone
    step(f"Planning zones: {len(zones):,} polygons", 0.45)
    del zones

    # --- Noise: Miljøstyrelsen where mapped, otherwise an estimate from road classes ----------
    # A cell has the loudest band of the polygons over it
    mst_level = np.zeros(grid.shape, dtype=np.uint8)
    agglomeration_roads = np.zeros(grid.shape, dtype=bool)
    mst_polygons = 0
    for mst in read_chunks(inputs["noise"], 2_000, bbox=(grid.x0, grid.y0, grid.x1, grid.y1), columns=["category", "source"]):
        mst_polygons += len(mst)
        for category, level in MST_BANDS.items():
            np.maximum(mst_level, grid.burn(mst[mst["category"] == category].geometry, value=level), out=mst_level)
        agglomeration_roads |= grid.burn(mst[mst["source"] == "roadsInAgglomeration"].geometry).astype(bool)
    # In the agglomerations (Copenhagen, Aarhus, Odense and Aalborg) every road is mapped, so their
    # byzone is quieter than 55 dB wherever the map has no band. Elsewhere only major roads are.
    agglomeration = ndimage.binary_dilation(agglomeration_roads, iterations=grid.cells(1_000)) & byzone
    del agglomeration_roads, byzone

    roads = read_layer(gpkg, "road")
    estimate = np.full(grid.shape, NOISE_FLOOR, dtype=np.float32)
    for road_class, level in ROAD_NOISE_AT_10M.items():
        cells = grid.burn(roads[roads["road_class"] == road_class].geometry, all_touched=True)
        # level - 10 log10(distance / 10), in place; farther than where it falls to the floor it does not count
        noise = grid.distance_to(cells.astype(bool), limit=10.0 * 10 ** ((level - NOISE_FLOOR) / 10))
        np.maximum(noise, 10.0, out=noise)
        np.divide(noise, 10.0, out=noise)
        np.log10(noise, out=noise)
        noise *= -10.0
        noise += level
        np.maximum(estimate, noise, out=estimate)
        del cells, noise
    del roads
    estimate = np.where(agglomeration, np.minimum(estimate, 54.0), estimate)
    road = np.where(mst_level > 0, mst_level, np.clip(np.round(estimate), 0, 99).astype(np.uint8))
    del estimate
    # Railways, airports and industry where Miljøstyrelsen maps them: their band counts where it is
    # louder than the road's
    other = np.zeros(grid.shape, dtype=np.uint8)
    for key, what in OTHER_NOISE.items():
        if inputs.get(key) is None:
            warn(f"No noise map of {what}: the noise is the roads' alone")
            continue
        for polygons in read_chunks(inputs[key], 2_000, bbox=(grid.x0, grid.y0, grid.x1, grid.y1), columns=["category"]):
            for category, level in MST_BANDS.items():
                np.maximum(other, grid.burn(polygons[polygons["category"] == category].geometry, value=level), out=other)
    louder = other > road
    layers["noise"] = np.where(louder, other + 100, np.where(mst_level > 0, road + 100, road)).astype(np.uint8)
    mapped = float((mst_level > 0)[region_land].mean()) if region_land.any() else 0.0
    other_share = float(louder[region_land].mean()) if region_land.any() else 0.0
    step(f"Noise: {mst_polygons:,} MST polygons of roads; {mapped:.1%} of the region's land mapped by MST; "
         f"agglomerations cover {agglomeration[region_land].mean() if region_land.any() else 0:.1%}; "
         f"railways, airports or industry are louder on {other_share:.1%}", 0.65)
    del mst_level, agglomeration, road, other, louder

    # --- Homes: OSM address points (imported from the national address register) -------------
    lons_lats = np.load(inputs["osm_addresses"]).reshape(-1, 2)
    address_count = grid.burn_points(*points_utm(lons_lats[:, 0], lons_lats[:, 1]))
    found["addresses"] = len(lons_lats)
    del lons_lats
    industrial_cells = grid.burn(read_layer(gpkg, "industrial").geometry).astype(bool)
    radius = grid.cells(300)  # the addresses within 300 m
    yy, xx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
    disk = ((xx ** 2 + yy ** 2) <= radius ** 2).astype(np.int32)
    density = ndimage.convolve(address_count, disk, mode="constant")
    layers["density"] = np.clip(density, 0, 255).astype(np.uint8)
    homes = (address_count > 0) & ~industrial_cells & region_land
    del density, address_count, industrial_cells
    step(f"Addresses: {found['addresses']:,}; cells with homes in the region: {homes.sum():,}", 0.75)

    # --- Municipal statistics (Danmarks Statistik) ---------------------------------------------
    tax = jsonstat_matrix(inputs["tax"], "SKATPCT")
    burglaries = jsonstat_values(inputs["burglaries"])
    population = jsonstat_values(inputs["population"])
    # Statistics a municipality may lack, by their field in the meta: the newest year with numbers
    optional = {}
    for field, key in (("income", "income"), ("nurseryPrice", "nursery_price"), ("classSize", "class_size")):
        if inputs.get(key):
            optional[field] = jsonstat_newest(inputs[key])[1]
        else:
            warn(f"No source for {key}: the municipalities have none")
    municipality_stats = []
    for row in region.itertuples():
        municipality_stats.append({
            "index": row.index, "code": row.code, "name": row.name,
            "incomeTax": tax[row.code]["KOM"], "landTax": tax[row.code]["GRUND"],
            "population": population[row.code],
            "burglariesPer1000": round(burglaries[row.code] / population[row.code] * 1000, 2),
            **{field: values[row.code] for field, values in optional.items() if values.get(row.code)},
        })
    layers["municipality"] = np.where(region_land, municipality_index, 0).astype(np.uint8)

    # --- Air quality (DCE): yearly means on a 1 km grid of squares in EPSG:25832 ----------------
    for name, (prop, steps) in CONCENTRATIONS.items():
        layers[name] = concentration(grid, inputs.get(name), prop, steps)
    step(f"Air quality: NO₂ for {(layers['no2'] > 0).sum():,} cells, PM2.5 for {(layers['pm25'] > 0).sum():,}", 0.78)

    # --- Drinking water: its hardness in the public waterworks' supply areas (GEUS) ------------
    if inputs.get("water_hardness"):
        hardness, areas = water_hardness(grid, inputs["water_hardness"])
        layers["water_hardness"] = hardness
        step(f"Drinking water: {areas:,} supply areas cover {(hardness > 0).sum() * cell * cell / 1e6:,.0f} km² of cells", 0.785)
        del hardness
    else:
        warn("No source for water_hardness: the layer is left out")

    # --- The height above sea level (the Copernicus elevation model) ------------------------------
    if inputs.get("elevation"):
        layers["elevation"] = elevation(grid, inputs["elevation"])
        raw = layers["elevation"][region_land]
        heights = raw[raw > 0].astype(np.int32) - 1 + ELEVATION_MIN
        step(f"Elevation from {len(inputs['elevation'])} tiles: {heights.size:,} of {raw.size:,} land cells, "
             + (f"from {heights.min()} to {heights.max()} m, {(heights < 3).sum() * cell * cell / 1e6:,.0f} km² below 3 m" if heights.size else "none"), 0.79)
        del raw, heights
    else:
        warn("No source for elevation: the layer is left out")

    # --- Chargers for electric cars: points, whose distances the browser finds for the operators chosen
    charger_sites, charger_counts = chargers(grid, gpkg, inputs.get("chargers"))
    (out / "chargers.json").write_text(json.dumps(charger_sites, separators=(",", ":")), encoding="utf-8")
    by_operator = np.bincount([point[2] for point in charger_sites["points"]], minlength=len(charger_sites["operators"]))
    # Counted per source, so the pack switches in when GeoFA comes in addition to OpenStreetMap
    found.update(charger_counts)
    step(f"Chargers for electric cars: {charger_counts.get('chargersGeofa', 0):,} from GeoFA and {charger_counts.get('chargersOsm', 0):,} from OpenStreetMap, "
         f"{len(charger_sites['points']):,} sites" + ("" if inputs.get("chargers") else ", from OpenStreetMap alone") + ": "
         + ", ".join(f"{operator} {count:,}" for operator, count in zip(charger_sites["operators"], by_operator)), 0.795)
    del charger_sites

    # --- Sample onto a Web Mercator display grid ------------------------------------------------
    to_merc = Transformer.from_crs("EPSG:25832", "EPSG:3857", always_xy=True)
    from_merc = Transformer.from_crs("EPSG:3857", "EPSG:25832", always_xy=True)
    to_lonlat = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
    edge = np.linspace(0, 1, 50)
    ex = np.concatenate([rx0 + (rx1 - rx0) * edge, np.full(50, rx1), rx0 + (rx1 - rx0) * edge, np.full(50, rx0)])
    ey = np.concatenate([np.full(50, ry0), ry0 + (ry1 - ry0) * edge, np.full(50, ry1), ry0 + (ry1 - ry0) * edge])
    mx, my = to_merc.transform(ex, ey)
    mx0, mx1, my0, my1 = mx.min(), mx.max(), my.min(), my.max()
    lat_mid = np.radians(to_lonlat.transform((mx0 + mx1) / 2, (my0 + my1) / 2)[1])
    pixel = display / np.cos(lat_mid)  # Web Mercator metres per display pixel, about `display` m on the ground
    width, height = int(np.ceil((mx1 - mx0) / pixel)), int(np.ceil((my1 - my0) / pixel))
    mx1, my0 = mx0 + width * pixel, my1 - height * pixel
    px = mx0 + (np.arange(width) + 0.5) * pixel
    py = my1 - (np.arange(height) + 0.5) * pixel
    # The grid cell under each display cell, a strip of rows at a time
    cols = np.empty((height, width), dtype=np.int32)
    rows_ = np.empty((height, width), dtype=np.int32)
    inside = np.empty((height, width), dtype=bool)
    for r0 in range(0, height, 256):
        r1 = min(height, r0 + 256)
        gx, gy = np.meshgrid(px, py[r0:r1])
        ux, uy = from_merc.transform(gx.ravel(), gy.ravel())
        strip_cols = ((ux - grid.x0) // cell).reshape(r1 - r0, width)
        strip_rows = ((grid.y1 - uy) // cell).reshape(r1 - r0, width)
        inside[r0:r1] = (strip_cols >= 0) & (strip_cols < grid.width) & (strip_rows >= 0) & (strip_rows < grid.height)
        cols[r0:r1] = np.clip(strip_cols, 0, grid.width - 1)
        rows_[r0:r1] = np.clip(strip_rows, 0, grid.height - 1)
    del gx, gy, ux, uy, strip_cols, strip_rows

    def sample(raster: np.ndarray) -> np.ndarray:
        values = raster[rows_, cols]
        return np.where(inside, values, 0).astype(raster.dtype)

    # The detail tiles show the grid's own cells, so their mask has the homes as they are
    detail_mask = region_land.astype(np.uint8) | (homes.astype(np.uint8) << 1)
    # A display cell larger than the grid's has homes when any grid cell around its centre has
    factor = display / cell
    if factor > 1:
        homes = ndimage.maximum_filter(homes, size=int(np.ceil(factor)) + 1) & region_land
    layers["mask"] = region_land.astype(np.uint8) | (homes.astype(np.uint8) << 1)

    present = [name for name in LAYERS if name in layers]
    files = {}
    for name in present:
        data = sample(layers[name])
        path = out / f"{name}.u8.gz"
        path.write_bytes(gzip.compress(data.tobytes(), compresslevel=9, mtime=0))
        files[name] = path.name
    display_mask = sample(layers["mask"])
    step(f"Display grid {width} × {height} at {display} m; wrote {len(files)} layers "
         f"({sum((out / f).stat().st_size for f in files.values()) / 1e6:.1f} MB); display cells: "
         f"{(display_mask & 1).astype(bool).sum():,} land, {(display_mask & 2).astype(bool).sum():,} with homes", 0.95)

    # --- Detail tiles: the grid's own cells, for the map zoomed in -------------------------------
    # Where the display grid is coarser than the grid, the same area is also cut into tiles of TILE ×
    # TILE cells at the grid's cell size, aligned with the display grid, holding every layer.
    tiles = None
    if display > cell:
        detail = cell / np.cos(lat_mid)
        columns, rows_count = int(np.ceil((mx1 - mx0) / detail / TILE)), int(np.ceil((my1 - my0) / detail / TILE))
        (out / "tiles").mkdir(exist_ok=True)
        detail_layers = {**{name: layers[name] for name in present if name != "mask"}, "mask": detail_mask}
        available = []
        offsets = (np.arange(TILE) + 0.5) * detail
        for ty in range(rows_count):
            for tx in range(columns):
                tx0, ty1 = mx0 + tx * TILE * detail, my1 - ty * TILE * detail
                tgx, tgy = np.meshgrid(tx0 + offsets, ty1 - offsets)
                tux, tuy = from_merc.transform(tgx.ravel(), tgy.ravel())
                tcols = ((tux - grid.x0) // cell).astype(np.int64)
                trows = ((grid.y1 - tuy) // cell).astype(np.int64)
                tinside = (tcols >= 0) & (tcols < grid.width) & (trows >= 0) & (trows < grid.height)
                tcols, trows = np.clip(tcols, 0, grid.width - 1), np.clip(trows, 0, grid.height - 1)
                mask = np.where(tinside, detail_layers["mask"][trows, tcols], 0)
                if not (mask & 1).any():
                    continue
                data = b"".join(np.where(tinside, detail_layers[name][trows, tcols], 0).astype(np.uint8).tobytes() for name in present)
                (out / "tiles" / f"{tx}-{ty}.u8.gz").write_bytes(gzip.compress(data, compresslevel=6, mtime=0))
                available.append(f"{tx}-{ty}")
            progress(0.95 + 0.04 * (ty + 1) / rows_count)
        tiles = {
            "cellMetres": cell, "size": TILE, "columns": columns, "rows": rows_count,
            "origin": {"x": float(mx0), "y": float(my1)}, "pixel": float(detail), "layers": present, "available": available,
        }
        step(f"Detail tiles at {cell} m: {len(available)} of {columns} × {rows_count} have land "
             f"({sum((out / 'tiles' / f'{key}.u8.gz').stat().st_size for key in available) / 1e6:.1f} MB)", 0.99)

    west, north = to_lonlat.transform(mx0, my1)
    east, south = to_lonlat.transform(mx1, my0)
    meta = {
        "built": date.today().isoformat(),
        "region": {"id": region_id, "name": region_name},
        "width": width, "height": height,
        "bounds": {"west": west, "south": south, "east": east, "north": north},
        "cellMetres": display,
        "gridMetres": cell,
        "distanceMax": DIST_MAX,
        "files": files,
        "sites": {"chargers": "chargers.json"},
        **({"tiles": tiles} if tiles else {}),
        "municipalities": municipality_stats,
        "counts": {
            "addresses": found["addresses"], "homeCells": int((display_mask & 2).astype(bool).sum()),
            "regionLandCells": int((display_mask & 1).astype(bool).sum()),
            "supermarkets": found["supermarkets"], "stations": found["stations"],
            "schools": found["schools"], "daycare": found["daycare"], "pharmacies": found["pharmacies"],
            "libraries": found["libraries"], "turbines": found["turbines"],
            **{key: found[key] for key in ("chargersGeofa", "chargersOsm") if key in found},
            "mstShareOfRegion": round(mapped, 4),
        },
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    layers.close()
    step("Done", 1)
    return meta


def cli(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="grid", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("inputs", type=Path, help="inputs.json")
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--region", default="denmark", help="denmark, oestjylland, aarhus, or municipality codes such as 751,706")
    parser.add_argument("--cell", type=int, default=100, help="grid cell size in metres (default 100)")
    parser.add_argument("--display", type=int, default=None, help="display cell size in metres (default 200 for Denmark, else 100)")
    args = parser.parse_args(argv)
    if not 10 <= args.cell <= 1_000:
        parser.error("--cell has to be from 10 to 1000 metres")
    build(read_inputs(args.inputs), args.out_dir, args.region, args.cell, args.display)
