"""Build the feature grid for a region: all of Denmark, the East Jutland pilot, or Aarhus for tests.

Every criterion becomes one 8-bit raster on a 100 m grid in EPSG:25832, aligned to
Det Danske Kvadratnet. The rasters are then sampled onto a Web Mercator display grid
so the browser can draw them directly on the map, and written as gzipped bytes. The
display grid is 100 m for a region and 200 m for the whole country, so the browser can
hold every layer in memory.

Usage:
    python build_grid.py <raw_dir> <osm_work_dir> <site_data_dir> [--region denmark] [--display 200]

<raw_dir> holds the downloads (mst/, stil/, ens/, plandata/, dst/) and <osm_work_dir> the
output of extract_osm.py (layers.gpkg and addresses.npy).
"""

import argparse
import csv
import gzip
import json
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

CELL = 100  # metres
BUFFER = 10_000  # metres of context around the region, so distances near borders are right
DIST_MAX = 20_000  # metres; distances are stored with a square-root encoding up to this value

REGIONS = {
    "denmark": {"name": "Danmark", "codes": None},  # every municipality
    "oestjylland": {"name": "Østjylland", "codes": ["751", "730", "710", "740", "746", "615", "727", "766", "706", "707", "741"]},
    # A small region for the frontend's end-to-end tests (frontend/e2e/data-pack)
    "aarhus": {"name": "Aarhus Kommune", "codes": ["751"]},
}

ROAD_NOISE_AT_10M = {"motorway": 76.0, "trunk": 72.0, "primary": 69.0, "secondary": 65.0}
NOISE_FLOOR = 40.0
MST_BANDS = {"Lden5559": 57, "Lden6064": 62, "Lden6569": 67, "Lden7074": 72, "LdenGreaterThan75": 77}


class Grid:
    """A north-up raster grid in EPSG:25832."""

    def __init__(self, x0: float, y0: float, x1: float, y1: float):
        self.x0, self.y0 = np.floor(x0 / CELL) * CELL, np.floor(y0 / CELL) * CELL
        self.x1, self.y1 = np.ceil(x1 / CELL) * CELL, np.ceil(y1 / CELL) * CELL
        self.width = int((self.x1 - self.x0) / CELL)
        self.height = int((self.y1 - self.y0) / CELL)
        self.transform = from_origin(self.x0, self.y1, CELL, CELL)

    @property
    def shape(self) -> tuple[int, int]:
        return self.height, self.width

    def burn(self, geometries, value=1, all_touched=False, dtype="uint8", fill=0) -> np.ndarray:
        shapes = [(geom, value) for geom in geometries if geom is not None and not geom.is_empty]
        if not shapes:
            return np.full(self.shape, fill, dtype=dtype)
        return rasterize(shapes, out_shape=self.shape, transform=self.transform,
                         all_touched=all_touched, fill=fill, dtype=dtype)

    def burn_points(self, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
        counts = np.zeros(self.shape, dtype=np.int32)
        cols = ((xs - self.x0) // CELL).astype(np.int64)
        rows = ((self.y1 - ys) // CELL).astype(np.int64)
        inside = (cols >= 0) & (cols < self.width) & (rows >= 0) & (rows < self.height)
        np.add.at(counts, (rows[inside], cols[inside]), 1)
        return counts

    def distance_to(self, mask: np.ndarray) -> np.ndarray:
        """Distance in metres from every cell to the nearest cell where mask is true."""
        if not mask.any():
            return np.full(self.shape, np.inf, dtype=np.float32)
        return (ndimage.distance_transform_edt(~mask.astype(bool)) * CELL).astype(np.float32)


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
    dataset = json.loads(path.read_text())["dataset"]
    areas = dataset["dimension"]["OMRÅDE"]["category"]["index"]
    values = dataset["value"]
    sizes = dataset["dimension"]["size"]
    stride = int(np.prod(sizes[1:]))
    return {code: values[index * stride] for code, index in areas.items()}


def jsonstat_matrix(path: Path, dim: str) -> dict[str, dict[str, float]]:
    """Read a JSON-stat response with OMRÅDE x <dim> into {area: {dim value: value}}."""
    dataset = json.loads(path.read_text())["dataset"]
    areas = dataset["dimension"]["OMRÅDE"]["category"]["index"]
    others = dataset["dimension"][dim]["category"]["index"]
    values = dataset["value"]
    return {a: {o: values[ai * len(others) + oi] for o, oi in others.items()} for a, ai in areas.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("raw", type=Path)
    parser.add_argument("osm", type=Path)
    parser.add_argument("site_data", type=Path)
    parser.add_argument("--region", choices=REGIONS, default="denmark")
    parser.add_argument("--display", type=int, default=None, help="display cell size in metres (default 200 for Denmark, else 100)")
    args = parser.parse_args()
    raw, gpkg, site_data = args.raw, args.osm / "layers.gpkg", args.site_data
    region_spec = REGIONS[args.region]
    display = args.display or (200 if args.region == "denmark" else 100)
    site_data.mkdir(parents=True, exist_ok=True)
    started = time.time()

    def log(message: str) -> None:
        print(f"[{time.time() - started:6.1f}s] {message}", flush=True)

    # --- Municipalities, land and sea ---------------------------------------------------------
    # OSM's Danish municipalities follow the coastline and carry the municipality code in "ref",
    # so together they are the land, and the code links them to Danmarks Statistik.
    municipalities = to_utm(pyogrio.read_dataframe(gpkg, layer="municipality"))
    municipalities = municipalities[municipalities["ref"].str.fullmatch(r"\d{3}")].sort_values("ref")
    codes = region_spec["codes"] or list(municipalities["ref"])
    rows = []
    for index, code in enumerate(codes, start=1):
        match = municipalities[municipalities["ref"] == code]
        if match.empty:
            raise SystemExit(f"Municipality {code} not found in OSM")
        name = match["name"].iloc[0].removesuffix(" Kommune").removesuffix(" Regionskommune")
        rows.append({"index": index, "code": code, "name": name, "geometry": match.geometry.union_all()})
    region = gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:25832")
    rx0, ry0, rx1, ry1 = region.total_bounds
    grid = Grid(rx0 - BUFFER, ry0 - BUFFER, rx1 + BUFFER, ry1 + BUFFER)
    log(f"{region_spec['name']}: {len(region)} municipalities; grid {grid.width} x {grid.height} cells ({grid.width * grid.height / 1e6:.1f} M)")

    municipality_index = np.zeros(grid.shape, dtype=np.uint8)
    for row in region.itertuples():
        municipality_index = np.maximum(municipality_index, grid.burn([row.geometry], value=row.index))
    land = grid.burn(municipalities.geometry).astype(bool)
    # The national boundary includes the territorial sea; what is inside it and not land is sea.
    # (The coastline alone cannot tell: the extract has almost no German or Swedish coast.)
    territory = grid.burn(to_utm(pyogrio.read_dataframe(gpkg, layer="country")).geometry).astype(bool)
    sea = territory & ~land

    # --- Nature ------------------------------------------------------------------------------
    layers: dict[str, np.ndarray] = {}
    forest = to_utm(pyogrio.read_dataframe(gpkg, layer="forest"))
    forest = forest[forest.area >= 50_000]  # woods of at least 5 ha
    layers["forest"] = encode_distance(grid.distance_to(grid.burn(forest.geometry)))
    del forest

    water = to_utm(pyogrio.read_dataframe(gpkg, layer="water"))
    water = water[water.area >= 50_000]  # lakes of at least 5 ha
    lakes = grid.burn(water.geometry).astype(bool)
    layers["water"] = encode_distance(grid.distance_to(lakes | sea))
    del water

    beach = to_utm(pyogrio.read_dataframe(gpkg, layer="beach"))
    layers["beach"] = encode_distance(grid.distance_to(grid.burn(beach.geometry, all_touched=True).astype(bool)))
    region_land = (municipality_index > 0) & ~lakes
    log(f"nature distances done; land cells in region: {region_land.sum():,} ({region_land.sum() * CELL * CELL / 1e6:,.0f} km²)")

    # --- Everyday services -------------------------------------------------------------------
    supermarkets = to_utm(pyogrio.read_dataframe(gpkg, layer="supermarket"))
    sx, sy = supermarkets.geometry.centroid.x.to_numpy(), supermarkets.geometry.centroid.y.to_numpy()
    layers["supermarket"] = encode_distance(grid.distance_to(grid.burn_points(sx, sy) > 0))

    stations = to_utm(pyogrio.read_dataframe(gpkg, layer="station"))
    tx, ty = stations.geometry.centroid.x.to_numpy(), stations.geometry.centroid.y.to_numpy()
    station_distance = grid.distance_to(grid.burn_points(tx, ty) > 0)
    layers["station"] = encode_distance(station_distance)
    del station_distance

    institutions = json.loads((raw / "stil" / "institutions.json").read_text())
    schools = [i for i in institutions
               if i["institutionTypeId"] in (1012, 1013)
               and (i.get("activeCodeName") or "").startswith("Aktiv")
               and i.get("latitude") and i.get("longitude")]
    cx, cy = points_utm([s["longitude"] for s in schools], [s["latitude"] for s in schools])
    layers["school"] = encode_distance(grid.distance_to(grid.burn_points(cx, cy) > 0))

    with open(raw / "stil" / "dagtilbud_LinkButtonAnv.csv", encoding="utf-8-sig", newline="") as handle:
        daycare = [r for r in csv.DictReader(handle, delimiter=";")
                   if r["aktivitetsstatus"] == "Aktiv" and r["geoBredde"] and r["geoLaengde"]]
    dx, dy = points_utm([float(r["geoLaengde"]) for r in daycare], [float(r["geoBredde"]) for r in daycare])
    layers["daycare"] = encode_distance(grid.distance_to(grid.burn_points(dx, dy) > 0))
    log(f"services: {len(supermarkets):,} supermarkets, {len(stations):,} stations, "
        f"{len(schools):,} schools, {len(daycare):,} daycare units")

    # --- Wind turbines (Energistyrelsen) -------------------------------------------------------
    sheet = openpyxl.load_workbook(raw / "ens" / "vinddata.xlsx", read_only=True, data_only=True).worksheets[0]
    turbine_x, turbine_y = [], []
    for values in sheet.iter_rows(min_row=4, values_only=True):
        decommissioned, x, y = values[3], values[13], values[14]
        if decommissioned or not x or not y:
            continue
        turbine_x.append(float(str(x).replace(",", ".")))
        turbine_y.append(float(str(y).replace(",", ".")))
    layers["turbine"] = encode_distance(grid.distance_to(grid.burn_points(np.array(turbine_x), np.array(turbine_y)) > 0))
    log(f"wind turbines in operation: {len(turbine_x):,}")

    # --- Planning zones (Plandata) -----------------------------------------------------------
    zones = gpd.read_file(raw / "plandata" / "zonekort.geojson")
    zones = zones.set_crs("EPSG:25832", allow_override=True)
    byzone = grid.burn(zones[zones["zone"] == 1].geometry).astype(bool)
    zone = np.where(land, 2, 0).astype(np.uint8)  # 2 = landzone unless mapped otherwise
    zone = np.where(byzone & land, 1, zone)
    zone = np.where(grid.burn(zones[zones["zone"] == 3].geometry).astype(bool) & land, 3, zone)
    layers["zone"] = zone
    log(f"planning zones: {len(zones):,} polygons")

    # --- Road noise: Miljøstyrelsen where mapped, otherwise an estimate from road classes ----
    noise_shp = raw / "mst" / "eu_vej_4m" / "eu_2022_vej_4m.shp"
    mst = pyogrio.read_dataframe(noise_shp, bbox=(grid.x0, grid.y0, grid.x1, grid.y1), columns=["category", "source"])
    mst_level = np.zeros(grid.shape, dtype=np.uint8)
    for category, level in sorted(MST_BANDS.items(), key=lambda item: item[1]):
        cells = grid.burn(mst[mst["category"] == category].geometry).astype(bool)
        mst_level = np.where(cells, level, mst_level)
    # In the agglomerations (Copenhagen, Aarhus, Odense, Aalborg) every road is mapped, so their
    # byzone is quieter than 55 dB wherever the map has no band. Elsewhere only major roads are.
    agglomeration_roads = grid.burn(mst[mst["source"] == "roadsInAgglomeration"].geometry).astype(bool)
    agglomeration = ndimage.binary_dilation(agglomeration_roads, iterations=10) & byzone

    roads = to_utm(pyogrio.read_dataframe(gpkg, layer="road"))
    estimate = np.full(grid.shape, NOISE_FLOOR, dtype=np.float32)
    for road_class, level in ROAD_NOISE_AT_10M.items():
        cells = grid.burn(roads[roads["road_class"] == road_class].geometry, all_touched=True)
        distance = np.maximum(grid.distance_to(cells.astype(bool)), 10.0)
        estimate = np.maximum(estimate, level - 10.0 * np.log10(distance / 10.0))
    estimate = np.where(agglomeration, np.minimum(estimate, 54.0), estimate)
    layers["noise"] = np.where(mst_level > 0, mst_level + 100, np.clip(np.round(estimate), 0, 99)).astype(np.uint8)
    del estimate, agglomeration_roads
    log(f"noise: {len(mst):,} MST polygons; {(mst_level > 0)[region_land].mean():.1%} of region land mapped by MST; "
        f"agglomerations cover {agglomeration[region_land].mean():.1%}")

    # --- Homes proxy: OSM address points (imported from the national address register) ------
    lons_lats = np.load(args.osm / "addresses.npy")
    ax, ay = points_utm(lons_lats[:, 0], lons_lats[:, 1])
    address_count = grid.burn_points(ax, ay)
    industrial = to_utm(pyogrio.read_dataframe(gpkg, layer="industrial"))
    industrial_cells = grid.burn(industrial.geometry).astype(bool)
    radius = 3  # cells, i.e. 300 m
    yy, xx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
    disk = ((xx ** 2 + yy ** 2) <= radius ** 2).astype(np.float32)
    density = ndimage.convolve(address_count.astype(np.float32), disk, mode="constant")
    layers["density"] = np.clip(np.round(density), 0, 255).astype(np.uint8)
    homes = (address_count > 0) & ~industrial_cells & region_land
    del density, address_count
    log(f"addresses: {len(ax):,}; 100 m cells with homes in region: {homes.sum():,}")

    # --- Municipal statistics (Danmarks Statistik) ---------------------------------------------
    tax = jsonstat_matrix(raw / "dst" / "pskat.json", "SKATPCT")
    burglaries = jsonstat_values(raw / "dst" / "straf.json")
    population = jsonstat_values(raw / "dst" / "folk.json")
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
    cols = ((ux - grid.x0) // CELL).astype(np.int64).reshape(height, width)
    rows_ = ((grid.y1 - uy) // CELL).astype(np.int64).reshape(height, width)
    inside = (cols >= 0) & (cols < grid.width) & (rows_ >= 0) & (rows_ < grid.height)
    cols, rows_ = np.clip(cols, 0, grid.width - 1), np.clip(rows_, 0, grid.height - 1)

    def sample(raster: np.ndarray) -> np.ndarray:
        out = raster[rows_, cols]
        return np.where(inside, out, 0).astype(raster.dtype)

    # A display cell larger than the 100 m grid has homes when any 100 m cell around its centre has
    factor = display / CELL
    if factor > 1:
        homes = ndimage.maximum_filter(homes, size=int(np.ceil(factor)) + 1) & region_land
    layers["mask"] = region_land.astype(np.uint8) | (homes.astype(np.uint8) << 1)

    files = {}
    for name in ["forest", "water", "beach", "noise", "supermarket", "school", "daycare", "station", "turbine",
                 "density", "zone", "municipality", "mask"]:
        data = sample(layers[name])
        path = site_data / f"{name}.u8.gz"
        path.write_bytes(gzip.compress(data.tobytes(), compresslevel=9, mtime=0))
        files[name] = path.name
    display_mask = sample(layers["mask"])
    log(f"display grid {width} x {height} at {display} m; wrote {len(files)} layers "
        f"({sum((site_data / f).stat().st_size for f in files.values()) / 1e6:.1f} MB); "
        f"display cells: {(display_mask & 1).astype(bool).sum():,} land, {(display_mask & 2).astype(bool).sum():,} with homes")

    # --- Municipal outlines for the map ------------------------------------------------------
    outlines = region[["index", "name", "geometry"]].copy()
    outlines["geometry"] = outlines.geometry.simplify(display * 0.4)
    outlines.to_crs("EPSG:4326").to_file(site_data / "municipalities.json", driver="GeoJSON", COORDINATE_PRECISION=5)

    # --- The area the detailed basemap has to cover --------------------------------------------
    coverage = gpd.GeoSeries([region.geometry.union_all().buffer(3_000).simplify(500)], crs="EPSG:25832")
    coverage.to_crs("EPSG:4326").to_file(site_data / "basemap-region.geojson", driver="GeoJSON", COORDINATE_PRECISION=4)

    west, north = to_lonlat.transform(mx0, my1)
    east, south = to_lonlat.transform(mx1, my0)
    meta = {
        "built": date.today().isoformat(),
        "region": {"id": args.region, "name": region_spec["name"]},
        "width": width, "height": height,
        "bounds": {"west": west, "south": south, "east": east, "north": north},
        "cellMetres": display,
        "distanceMax": DIST_MAX,
        "files": files,
        "municipalities": municipality_stats,
        "counts": {
            "addresses": int(len(ax)), "homeCells": int((display_mask & 2).astype(bool).sum()),
            "regionLandCells": int((display_mask & 1).astype(bool).sum()),
            "supermarkets": int(len(supermarkets)), "stations": int(len(stations)),
            "schools": int(len(schools)), "daycare": int(len(daycare)), "turbines": int(len(turbine_x)),
            "mstShareOfRegion": round(float((mst_level > 0)[region_land].mean()), 4),
        },
    }
    (site_data / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    log("done")


if __name__ == "__main__":
    main()
