"""Travel times to a place by car, by bike and on foot, on the road network (roads.py).

For every land cell of a data pack's map: the minutes from the cell to the place, as an 8-bit
layer like the pack's (255 for 255 minutes or more, or no way there). A trip starts at the best of
the nearest nodes the mode can use, going there at walking pace (cycling, by bike), and ends the
same way at the place. By car it takes CAR_PARKING_S more, to park.

Usage:
    python -m boligmaskinen_pipeline travel <roads> <data-pack> <lng> <lat> <out_dir> [--cache <dir>]

<out_dir> gets car.png, bike.png and walk.png, byte containers like the pack's layers. With
--cache, the nearest nodes of the pack's cells are kept there for the next place on the same pack
and network.
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
from pyproj import Transformer
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree

from .memory import release
from .pack import png_container, read_container
from .progress import log, progress

MODES = ["car", "bike", "walk"]
# How fast one gets between a cell or the place and the network
ACCESS_KMH = {"car": 5, "bike": 10, "walk": 5}
CAR_PARKING_S = 120
# The nearest nodes a trip may start or end at, so a cell next to a dead end still finds its way
NEAREST = 4
MAX_MINUTES = 254
EARTH = 6378137


def land_cells(pack: Path) -> tuple[dict, np.ndarray, np.ndarray]:
    """The pack's meta.json, its land cells, and their centres in EPSG:25832 (two columns)."""
    meta = json.loads((pack / "data" / "meta.json").read_text(encoding="utf-8"))
    mask = np.frombuffer(read_container((pack / "data" / meta["files"]["mask"]).read_bytes()), dtype=np.uint8)
    width, height = meta["width"], meta["height"]
    if mask.size != width * height:
        raise SystemExit(f"The mask of {pack} has {mask.size} cells, not {width} × {height}")
    cells = np.flatnonzero(mask & 1)
    bounds = meta["bounds"]
    x0 = EARTH * np.radians(bounds["west"])
    x1 = EARTH * np.radians(bounds["east"])
    y1 = EARTH * np.log(np.tan(np.pi / 4 + np.radians(bounds["north"]) / 2))
    pixel = (x1 - x0) / width
    rows, cols = np.divmod(cells, width)
    x, y = Transformer.from_crs("EPSG:3857", "EPSG:25832", always_xy=True).transform(x0 + (cols + 0.5) * pixel, y1 - (rows + 0.5) * pixel)
    return meta, cells, np.column_stack([x, y])


def nearest_to_cells(roads, mode: str, cells: np.ndarray, cache: Path | None) -> tuple[np.ndarray, np.ndarray]:
    """The NEAREST start nodes of every cell, and how far they are in metres; kept in the cache."""
    cached = cache / f"{mode}-cells.npz" if cache else None
    if cached and cached.exists():
        with np.load(cached) as saved:
            return saved["nodes"], saved["metres"]
    start = np.flatnonzero(roads["start"])
    tree = cKDTree(np.column_stack([roads["x"][start], roads["y"][start]]))
    k = min(NEAREST, len(start))
    metres, index = tree.query(cells, k=k, workers=-1)
    nodes, metres = start[index].astype(np.int32).reshape(-1, k), metres.astype(np.float32).reshape(-1, k)
    if cached:
        cached.parent.mkdir(parents=True, exist_ok=True)
        np.savez(cached.with_suffix(".tmp.npz"), nodes=nodes, metres=metres)
        cached.with_suffix(".tmp.npz").replace(cached)
    return nodes, metres


def towards(roads, mode: str, place_nodes: np.ndarray, place_seconds: np.ndarray) -> csr_matrix:
    """The mode's network, turned around so the times from the place are the times to it, with the
    place as one more node, the last, joined to its nearest nodes."""
    indptr, indices, seconds = roads["indptr"], roads["indices"], roads["seconds"]
    nodes = len(indptr) - 1
    return csr_matrix((np.concatenate([seconds, np.maximum(place_seconds, 1e-3)]).astype(np.float64),
                       np.concatenate([indices, place_nodes]),
                       np.append(indptr, indptr[-1] + len(place_nodes))), shape=(nodes + 1, nodes + 1))


def minutes(roads, mode: str, place: np.ndarray, cells: np.ndarray, cache: Path | None) -> np.ndarray:
    """Minutes from every cell to the place, 0–254, or 255."""
    cell_nodes, cell_metres = nearest_to_cells(roads, mode, cells, cache)
    start = np.flatnonzero(roads["start"])
    to_place = np.hypot(roads["x"][start] - place[0], roads["y"][start] - place[1])
    near = np.argsort(to_place)[:NEAREST] if len(start) <= NEAREST else np.argpartition(to_place, NEAREST)[:NEAREST]
    access = ACCESS_KMH[mode] / 3.6
    graph = towards(roads, mode, start[near], to_place[near] / access)
    seconds = dijkstra(graph, directed=True, indices=graph.shape[0] - 1, limit=(MAX_MINUTES + 1) * 60)
    del graph

    total = np.min(seconds[cell_nodes] + cell_metres / access, axis=1) + (CAR_PARKING_S if mode == "car" else 0)
    return np.where(np.isfinite(total), np.clip(np.round(total / 60), 0, 255), 255).astype(np.uint8)


def build(roads_dir: Path, pack: Path, lng: float, lat: float, out: Path, cache: Path | None = None) -> dict[str, int]:
    """Write a layer of minutes per mode into `out`; returns how many land cells each mode reaches within MAX_MINUTES."""
    started = time.time()
    meta, cells, centres = land_cells(pack)
    place = np.array(Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True).transform(lng, lat))
    out.mkdir(parents=True, exist_ok=True)
    reached = {}
    for index, mode in enumerate(MODES):
        roads = {name: np.load(roads_dir / f"{name}.npy", mmap_mode="r") for name in ("x", "y")}
        roads |= {name: np.load(roads_dir / f"{mode}-{name}.npy", mmap_mode="r") for name in ("indptr", "indices", "seconds", "start")}
        layer = np.full(meta["width"] * meta["height"], 255, dtype=np.uint8)
        layer[cells] = minutes(roads, mode, place, centres, cache)
        (out / f"{mode}.png").write_bytes(png_container(layer.tobytes()))
        reached[mode] = int((layer[cells] < 255).sum())
        release()
        log(f"{mode}: {reached[mode]:,} of {len(cells):,} land cells within {MAX_MINUTES} minutes ({time.time() - started:.0f} s)")
        progress((index + 1) / len(MODES))
        del roads
    return reached


def cli(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="travel", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("roads", type=Path, help="the road network, as the roads step writes it")
    parser.add_argument("pack", type=Path, help="the data pack")
    parser.add_argument("lng", type=float)
    parser.add_argument("lat", type=float)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--cache", type=Path, help="where to keep the nearest nodes of the pack's cells")
    args = parser.parse_args(argv)
    if not (-180 <= args.lng <= 180 and -90 <= args.lat <= 90):
        parser.error("lng and lat have to be a longitude and a latitude")
    build(args.roads, args.pack, args.lng, args.lat, args.out_dir, args.cache)
