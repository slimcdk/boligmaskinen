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
    noise         eu_2022_vej_4m.shp (Miljøstyrelsen)  zones          zonekort.geojson (Plandata)
    institutions  institutions.json (STIL)             daycare        dagtilbud CSV (STIL)
    turbines      vinddata.xlsx (Energistyrelsen)      tax, burglaries, population  PSKAT, STRAF22, FOLK1A (DST)

The region is denmark, oestjylland, aarhus, or municipality codes such as 751,706.
<out_dir> gets a .u8.gz file per layer, meta.json, municipalities.json and basemap-region.geojson,
the outline the basemap has to cover.
"""

import argparse
import csv
import gzip
import json
import re
import time
from datetime import date
from pathlib import Path

import geopandas as gpd
import numpy as np
import openpyxl
import pyogrio
from pyproj import Transformer
from rasterio.features import rasterize
from rasterio.transform import from_origin
from scipy import ndimage

from .progress import log, progress, warn

BUFFER = 10_000  # metres of context around the region, so distances near borders are right
DIST_MAX = 20_000  # metres; distances are stored with a square-root encoding up to this value

REGIONS = {
    "denmark": {"name": "Danmark", "codes": None},  # every municipality
    "oestjylland": {"name": "Østjylland", "codes": ["751", "730", "710", "740", "746", "615", "727", "766", "706", "707", "741"]},
    # A small region for the frontend's end-to-end tests (frontend/e2e/data-pack)
    "aarhus": {"name": "Aarhus Kommune", "codes": ["751"]},
}
CODES = re.compile(r"^\d{3}(,\d{3})*$")

INPUTS = ["osm_layers", "osm_addresses", "noise", "zones", "institutions", "daycare", "turbines", "tax", "burglaries", "population"]

ROAD_NOISE_AT_10M = {"motorway": 76.0, "trunk": 72.0, "primary": 69.0, "secondary": 65.0}
NOISE_FLOOR = 40.0
MST_BANDS = {"Lden5559": 57, "Lden6064": 62, "Lden6569": 67, "Lden7074": 72, "LdenGreaterThan75": 77}

LAYERS = ["forest", "water", "beach", "noise", "supermarket", "school", "daycare", "station", "turbine",
          "density", "zone", "municipality", "mask"]


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

    def burn(self, geometries, value=1, all_touched=False, dtype="uint8", fill=0) -> np.ndarray:
        shapes = [(geom, value) for geom in geometries if geom is not None and not geom.is_empty]
        if not shapes:
            return np.full(self.shape, fill, dtype=dtype)
        return rasterize(shapes, out_shape=self.shape, transform=self.transform,
                         all_touched=all_touched, fill=fill, dtype=dtype)

    def burn_points(self, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
        counts = np.zeros(self.shape, dtype=np.int32)
        cols = ((np.asarray(xs) - self.x0) // self.cell).astype(np.int64)
        rows = ((self.y1 - np.asarray(ys)) // self.cell).astype(np.int64)
        inside = (cols >= 0) & (cols < self.width) & (rows >= 0) & (rows < self.height)
        np.add.at(counts, (rows[inside], cols[inside]), 1)
        return counts

    def distance_to(self, mask: np.ndarray) -> np.ndarray:
        """Distance in metres from every cell to the nearest cell where mask is true."""
        if not mask.any():
            return np.full(self.shape, np.inf, dtype=np.float32)
        return (ndimage.distance_transform_edt(~mask.astype(bool)) * self.cell).astype(np.float32)


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


def jsonstat_matrix(path: Path, dim: str) -> dict[str, dict[str, float]]:
    """Read a JSON-stat response with OMRÅDE x <dim> into {area: {dim value: value}}."""
    dataset = json.loads(path.read_text(encoding="utf-8"))["dataset"]
    areas = dataset["dimension"]["OMRÅDE"]["category"]["index"]
    others = dataset["dimension"][dim]["category"]["index"]
    values = dataset["value"]
    return {a: {o: values[ai * len(others) + oi] for o, oi in others.items()} for a, ai in areas.items()}


def read_inputs(path: Path) -> dict[str, Path]:
    """The source files named in inputs.json; every one has to be there."""
    named = json.loads(path.read_text(encoding="utf-8"))
    missing = [key for key in INPUTS if key not in named]
    if missing:
        raise SystemExit(f"{path} does not name: {', '.join(missing)}")
    files = {key: (path.parent / named[key]).resolve() for key in INPUTS}
    absent = [f"{key} ({file})" for key, file in files.items() if not file.exists()]
    if absent:
        raise SystemExit(f"Missing source files: {', '.join(absent)}")
    return files


def read_layer(gpkg: Path, layer: str) -> gpd.GeoDataFrame:
    """A layer of the OSM extract, or an empty one when the extract has none."""
    if layer not in {name for name, _ in pyogrio.list_layers(gpkg)}:
        warn(f"The OSM extract has no {layer} layer")
        return gpd.GeoDataFrame(geometry=[], crs="EPSG:25832")
    return to_utm(pyogrio.read_dataframe(gpkg, layer=layer))


def region_spec(region: str) -> dict:
    """A named region, or the municipalities whose codes are listed."""
    if region in REGIONS:
        return REGIONS[region]
    if CODES.match(region):
        return {"name": None, "codes": region.split(",")}
    raise SystemExit(f"The region has to be one of {', '.join(REGIONS)}, or municipality codes such as 751,706, not {region!r}")


def build(inputs: dict[str, Path], out: Path, region_id: str = "denmark", cell: int = 100, display: int | None = None) -> dict:
    """Build every layer of the region into `out`; returns meta.json's content."""
    spec = region_spec(region_id)
    display = max(cell, display or (200 if region_id == "denmark" else 100))
    out.mkdir(parents=True, exist_ok=True)
    gpkg = inputs["osm_layers"]
    started = time.time()

    def step(message: str, fraction: float) -> None:
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

    municipality_index = np.zeros(grid.shape, dtype=np.uint8)
    for row in region.itertuples():
        municipality_index = np.maximum(municipality_index, grid.burn([row.geometry], value=row.index))
    land = grid.burn(municipalities.geometry).astype(bool)
    # The national boundary includes the territorial sea; what is inside it and not land is sea.
    # (The coastline alone cannot tell: the extract has almost no German or Swedish coast.)
    territory = grid.burn(read_layer(gpkg, "country").geometry).astype(bool)
    sea = territory & ~land

    # --- Nature ------------------------------------------------------------------------------
    layers: dict[str, np.ndarray] = {}
    forest = read_layer(gpkg, "forest")
    forest = forest[forest.area >= 50_000]  # woods of at least 5 ha
    layers["forest"] = encode_distance(grid.distance_to(grid.burn(forest.geometry)))
    del forest

    water = read_layer(gpkg, "water")
    water = water[water.area >= 50_000]  # lakes of at least 5 ha
    lakes = grid.burn(water.geometry).astype(bool)
    layers["water"] = encode_distance(grid.distance_to(lakes | sea))
    del water

    beach = read_layer(gpkg, "beach")
    layers["beach"] = encode_distance(grid.distance_to(grid.burn(beach.geometry, all_touched=True).astype(bool)))
    region_land = (municipality_index > 0) & ~lakes
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
    step(f"Services: {len(supermarkets):,} supermarkets, {len(stations):,} stations, "
         f"{len(schools):,} schools, {len(daycare):,} daycare units", 0.35)

    # --- Wind turbines (Energistyrelsen) -------------------------------------------------------
    sheet = openpyxl.load_workbook(inputs["turbines"], read_only=True, data_only=True).worksheets[0]
    turbine_x, turbine_y = [], []
    for values in sheet.iter_rows(min_row=4, values_only=True):
        decommissioned, x, y = values[3], values[13], values[14]
        if decommissioned or not x or not y:
            continue
        turbine_x.append(float(str(x).replace(",", ".")))
        turbine_y.append(float(str(y).replace(",", ".")))
    layers["turbine"] = encode_distance(grid.distance_to(grid.burn_points(np.array(turbine_x), np.array(turbine_y)) > 0))
    step(f"Wind turbines in operation: {len(turbine_x):,}", 0.4)

    # --- Planning zones (Plandata) -----------------------------------------------------------
    zones = gpd.read_file(inputs["zones"])
    zones = zones.set_crs("EPSG:25832", allow_override=True)
    byzone = grid.burn(zones[zones["zone"] == 1].geometry).astype(bool)
    zone = np.where(land, 2, 0).astype(np.uint8)  # 2 = landzone unless mapped otherwise
    zone = np.where(byzone & land, 1, zone)
    zone = np.where(grid.burn(zones[zones["zone"] == 3].geometry).astype(bool) & land, 3, zone)
    layers["zone"] = zone
    step(f"Planning zones: {len(zones):,} polygons", 0.45)

    # --- Road noise: Miljøstyrelsen where mapped, otherwise an estimate from road classes ----
    mst = pyogrio.read_dataframe(inputs["noise"], bbox=(grid.x0, grid.y0, grid.x1, grid.y1), columns=["category", "source"])
    mst_level = np.zeros(grid.shape, dtype=np.uint8)
    for category, level in sorted(MST_BANDS.items(), key=lambda item: item[1]):
        cells = grid.burn(mst[mst["category"] == category].geometry).astype(bool)
        mst_level = np.where(cells, level, mst_level)
    # In the agglomerations (Copenhagen, Aarhus, Odense and Aalborg) every road is mapped, so their
    # byzone is quieter than 55 dB wherever the map has no band. Elsewhere only major roads are.
    agglomeration_roads = grid.burn(mst[mst["source"] == "roadsInAgglomeration"].geometry).astype(bool)
    agglomeration = ndimage.binary_dilation(agglomeration_roads, iterations=grid.cells(1_000)) & byzone

    roads = read_layer(gpkg, "road")
    estimate = np.full(grid.shape, NOISE_FLOOR, dtype=np.float32)
    for road_class, level in ROAD_NOISE_AT_10M.items():
        cells = grid.burn(roads[roads["road_class"] == road_class].geometry, all_touched=True)
        distance = np.maximum(grid.distance_to(cells.astype(bool)), 10.0)
        estimate = np.maximum(estimate, level - 10.0 * np.log10(distance / 10.0))
    estimate = np.where(agglomeration, np.minimum(estimate, 54.0), estimate)
    layers["noise"] = np.where(mst_level > 0, mst_level + 100, np.clip(np.round(estimate), 0, 99)).astype(np.uint8)
    del estimate, agglomeration_roads
    mapped = float((mst_level > 0)[region_land].mean()) if region_land.any() else 0.0
    step(f"Noise: {len(mst):,} MST polygons; {mapped:.1%} of the region's land mapped by MST; "
         f"agglomerations cover {agglomeration[region_land].mean() if region_land.any() else 0:.1%}", 0.65)

    # --- Homes: OSM address points (imported from the national address register) -------------
    lons_lats = np.load(inputs["osm_addresses"]).reshape(-1, 2)
    ax, ay = points_utm(lons_lats[:, 0], lons_lats[:, 1])
    address_count = grid.burn_points(ax, ay)
    industrial_cells = grid.burn(read_layer(gpkg, "industrial").geometry).astype(bool)
    radius = grid.cells(300)  # the addresses within 300 m
    yy, xx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
    disk = ((xx ** 2 + yy ** 2) <= radius ** 2).astype(np.float32)
    density = ndimage.convolve(address_count.astype(np.float32), disk, mode="constant")
    layers["density"] = np.clip(np.round(density), 0, 255).astype(np.uint8)
    homes = (address_count > 0) & ~industrial_cells & region_land
    del density, address_count
    step(f"Addresses: {len(ax):,}; cells with homes in the region: {homes.sum():,}", 0.75)

    # --- Municipal statistics (Danmarks Statistik) ---------------------------------------------
    tax = jsonstat_matrix(inputs["tax"], "SKATPCT")
    burglaries = jsonstat_values(inputs["burglaries"])
    population = jsonstat_values(inputs["population"])
    municipality_stats = []
    for row in region.itertuples():
        municipality_stats.append({
            "index": row.index, "code": row.code, "name": row.name,
            "incomeTax": tax[row.code]["KOM"], "landTax": tax[row.code]["GRUND"],
            "population": population[row.code],
            "burglariesPer1000": round(burglaries[row.code] / population[row.code] * 1000, 2),
        })
    layers["municipality"] = np.where(region_land, municipality_index, 0).astype(np.uint8)

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
    gx, gy = np.meshgrid(px, py)
    ux, uy = from_merc.transform(gx.ravel(), gy.ravel())
    cols = ((ux - grid.x0) // cell).astype(np.int64).reshape(height, width)
    rows_ = ((grid.y1 - uy) // cell).astype(np.int64).reshape(height, width)
    inside = (cols >= 0) & (cols < grid.width) & (rows_ >= 0) & (rows_ < grid.height)
    cols, rows_ = np.clip(cols, 0, grid.width - 1), np.clip(rows_, 0, grid.height - 1)

    def sample(raster: np.ndarray) -> np.ndarray:
        values = raster[rows_, cols]
        return np.where(inside, values, 0).astype(raster.dtype)

    # A display cell larger than the grid's has homes when any grid cell around its centre has
    factor = display / cell
    if factor > 1:
        homes = ndimage.maximum_filter(homes, size=int(np.ceil(factor)) + 1) & region_land
    layers["mask"] = region_land.astype(np.uint8) | (homes.astype(np.uint8) << 1)

    files = {}
    for name in LAYERS:
        data = sample(layers[name])
        path = out / f"{name}.u8.gz"
        path.write_bytes(gzip.compress(data.tobytes(), compresslevel=9, mtime=0))
        files[name] = path.name
    display_mask = sample(layers["mask"])
    step(f"Display grid {width} × {height} at {display} m; wrote {len(files)} layers "
         f"({sum((out / f).stat().st_size for f in files.values()) / 1e6:.1f} MB); display cells: "
         f"{(display_mask & 1).astype(bool).sum():,} land, {(display_mask & 2).astype(bool).sum():,} with homes", 0.95)

    # --- Municipal outlines for the map ------------------------------------------------------
    outlines = region[["index", "name", "geometry"]].copy()
    outlines["geometry"] = outlines.geometry.simplify(display * 0.4)
    outlines.to_crs("EPSG:4326").to_file(out / "municipalities.json", driver="GeoJSON", COORDINATE_PRECISION=5)

    # --- The area the detailed basemap has to cover --------------------------------------------
    coverage = gpd.GeoSeries([region.geometry.union_all().buffer(3_000).simplify(500)], crs="EPSG:25832")
    coverage.to_crs("EPSG:4326").to_file(out / "basemap-region.geojson", driver="GeoJSON", COORDINATE_PRECISION=4)

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
        "municipalities": municipality_stats,
        "counts": {
            "addresses": int(len(ax)), "homeCells": int((display_mask & 2).astype(bool).sum()),
            "regionLandCells": int((display_mask & 1).astype(bool).sum()),
            "supermarkets": int(len(supermarkets)), "stations": int(len(stations)),
            "schools": int(len(schools)), "daycare": int(len(daycare)), "turbines": int(len(turbine_x)),
            "mstShareOfRegion": round(mapped, 4),
        },
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
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
