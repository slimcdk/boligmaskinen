"""Build the road network that travel times are found on, from a Geofabrik extract.

The network has a node for every OSM node on a road, path or ferry route, and an edge for every
stretch between two of them: its length, and the speed by car each way, by bike each way and on
foot (0 where the mode may not go). The travel step (travel.py) finds the travel times to a place
on it. Like the osm step, it reads the extract once, with the node locations in a temporary file.

Usage:
    python -m boligmaskinen_pipeline roads <denmark-latest.osm.pbf> <out_dir>

<out_dir> gets NumPy files and counts.json: the nodes (x.npy, y.npy in EPSG:25832) and, per mode
(car, bike, walk), the network turned around as a sparse matrix in seconds (<mode>-indptr.npy,
<mode>-indices.npy, <mode>-seconds.npy), so the times from a place are the times to it, and the
nodes where trips can start (<mode>-start.npy). The travel step reads them as memory maps.
"""

import argparse
import json
import re
import tempfile
import time
from array import array
from pathlib import Path

import numpy as np
import osmium
from pyproj import Transformer
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components

from .memory import release
from .progress import log, progress

# Typical speeds in km/h by car, with junctions and towns, where the road has no maxspeed
CAR_KMH = {
    "motorway": 110, "motorway_link": 60, "trunk": 80, "trunk_link": 50, "primary": 65, "primary_link": 45,
    "secondary": 55, "secondary_link": 40, "tertiary": 45, "tertiary_link": 35, "unclassified": 40,
    "residential": 30, "living_street": 10, "service": 15, "road": 30,
}
# Where the speed limit is posted, cars average this share of it
MAXSPEED_SHARE = 0.85
MAXSPEED_ZONES = {"DK:urban": 50, "DK:rural": 80, "DK:motorway": 130}
# Bikes and feet go on most roads, and on the paths too
BIKE_KMH = {**{road: 16 for road in CAR_KMH}, "living_street": 10, "service": 14, "cycleway": 18, "track": 12,
            "path": 12, "footway": 10, "pedestrian": 10}
WALK_KMH = {**{road: 5 for road in CAR_KMH}, "track": 5, "path": 5, "footway": 5, "pedestrian": 5, "cycleway": 5,
            "bridleway": 5, "steps": 2}
NO_BIKES = {"motorway", "motorway_link", "trunk_link", "steps", "bridleway"}
NO_FEET = {"motorway", "motorway_link", "trunk", "trunk_link"}
# A path or footway takes bikes only where its tags say so; the rest take them unless the tags say no
BIKES_IF_ALLOWED = {"footway", "pedestrian"}
YES = {"yes", "designated", "permissive", "destination"}
NO = {"no", "private", "use_sidepath"}
# Ferries: their own duration where it is tagged, otherwise this speed, and a wait to board
FERRY_KMH = 25
FERRY_WAIT_S = 15 * 60
# Trips start and end on these, not on a motorway
NO_START = {"motorway", "motorway_link"}
# ...and in a network of at least this many nodes, not on a footway inside a station that the
# extract does not join to the streets
MIN_NETWORK = 1_000
MODES = {"car": (0, 1), "bike": (2, 3), "walk": (4, 4)}


def allowed(tags, mode_keys: tuple[str, ...], default: bool) -> bool:
    """Whether a mode may use a way: its own tags first (bicycle=yes), then access=."""
    for key in mode_keys:
        value = tags.get(key)
        if value in YES:
            return True
        if value in NO:
            return False
    access = tags.get("access")
    if access in NO:
        return False
    return default


def car_kmh(tags, highway: str) -> float:
    """The average speed by car: from the posted limit where there is one, else the road's class."""
    maxspeed = tags.get("maxspeed", "")
    limit = MAXSPEED_ZONES.get(maxspeed)
    if limit is None and re.fullmatch(r"\d{1,3}", maxspeed):
        limit = int(maxspeed)
    return limit * MAXSPEED_SHARE if limit else CAR_KMH[highway]


def oneway(tags, highway: str) -> int:
    """1 for one way forwards, -1 backwards, 0 both ways."""
    value = tags.get("oneway")
    if value in ("yes", "true", "1"):
        return 1
    if value in ("-1", "reverse"):
        return -1
    if value == "no":
        return 0
    return 1 if highway in ("motorway", "motorway_link") or tags.get("junction") == "roundabout" else 0


def tagged_duration(tags) -> float:
    """A ferry's tagged duration in seconds (h:mm, h:mm:ss or minutes), or -1."""
    duration = tags.get("duration", "")
    parts = duration.split(":")
    if 2 <= len(parts) <= 3 and all(part.isdigit() for part in parts):
        return float(sum(int(part) * 60 ** (2 - index) for index, part in enumerate(parts + ["0"] * (3 - len(parts)))))
    if duration.isdigit():
        return int(duration) * 60.0
    return -1.0


def rules(tags) -> tuple[float, float, float, float, float, bool, bool] | None:
    """Speeds in km/h by car forwards and backwards, by bike forwards and backwards, and on foot;
    whether the way is a ferry, and whether trips can start on it. None for a way no mode uses."""
    highway = tags.get("highway")
    if tags.get("route") == "ferry" and highway is None:
        cars = allowed(tags, ("motorcar", "motor_vehicle", "vehicle"), True)
        bikes = allowed(tags, ("bicycle",), True)
        feet = allowed(tags, ("foot",), True)
        if not (cars or bikes or feet):
            return None
        # A ferry's time is its own (see build); the speeds only say who may board
        return float(cars), float(cars), float(bikes), float(bikes), float(feet), True, True
    if highway not in CAR_KMH and highway not in BIKE_KMH and highway not in WALK_KMH:
        return None
    if tags.get("area") == "yes" and highway != "pedestrian":
        return None
    car = car_kmh(tags, highway) if highway in CAR_KMH and allowed(tags, ("motorcar", "motor_vehicle", "vehicle"), True) else 0.0
    if highway in BIKE_KMH and highway not in NO_BIKES:
        bike = BIKE_KMH[highway] if allowed(tags, ("bicycle",), highway not in BIKES_IF_ALLOWED) else 0.0
    else:
        bike = BIKE_KMH.get(highway, 0.0) if tags.get("bicycle") in YES else 0.0
    if tags.get("motorroad") == "yes":
        bike = 0.0
    feet_default = highway not in NO_FEET and tags.get("motorroad") != "yes"
    walk = WALK_KMH[highway] if highway in WALK_KMH and allowed(tags, ("foot",), feet_default) else 0.0
    if not (car or bike or walk):
        return None
    direction = oneway(tags, highway)
    bike_direction = 0 if tags.get("oneway:bicycle") == "no" or tags.get("cycleway", "").startswith("opposite") else direction
    car_ahead, car_back = (car if direction >= 0 else 0.0), (car if direction <= 0 else 0.0)
    bike_ahead, bike_back = (bike if bike_direction >= 0 else 0.0), (bike if bike_direction <= 0 else 0.0)
    return car_ahead, car_back, bike_ahead, bike_back, walk, False, highway not in NO_START


def build(pbf: Path, out_dir: Path) -> dict[str, int]:
    """Write the network of the extract into out_dir; returns how many nodes and edges it has."""
    out_dir.mkdir(parents=True, exist_ok=True)
    started = time.time()
    refs, lons, lats = array("q"), array("d"), array("d")
    breaks = array("q")  # the index of each way's first node
    speeds = array("f")  # five per way
    ferry, ferry_tagged = array("q"), array("d")  # the ways that are ferries, and their tagged durations
    starts = array("b")  # per way: trips can start on it
    with tempfile.TemporaryDirectory(prefix="roads-") as tmp:
        processor = (osmium.FileProcessor(str(pbf))
                     .with_locations(f"sparse_file_array,{Path(tmp) / 'locations'}")
                     .with_filter(osmium.filter.EntityFilter(osmium.osm.WAY))
                     .with_filter(osmium.filter.KeyFilter("highway", "route")))
        for way in processor:
            rule = rules(way.tags)
            if rule is None:
                continue
            first = len(refs)
            for node in way.nodes:
                location = node.location
                if not location.valid():
                    continue  # outside the extract
                refs.append(node.ref)
                lons.append(location.lon)
                lats.append(location.lat)
            if len(refs) - first < 2:
                del refs[first:], lons[first:], lats[first:]
                continue
            if rule[5]:
                ferry.append(len(breaks))
                ferry_tagged.append(tagged_duration(way.tags))
            breaks.append(first)
            speeds.extend(rule[:5])
            starts.append(rule[6])
    log(f"Read {len(breaks):,} ways with {len(refs):,} nodes in {time.time() - started:.0f} s")
    progress(0.6)

    # Nodes: one per OSM node, in EPSG:25832
    started = time.time()
    ids, node_of = np.unique(np.frombuffer(refs, dtype=np.int64), return_inverse=True)
    del refs
    node_of = node_of.astype(np.int32)
    first_ref = np.zeros(len(ids), dtype=np.int64)
    first_ref[node_of[::-1]] = np.arange(len(node_of) - 1, -1, -1)
    lon, lat = np.frombuffer(lons, dtype=np.float64)[first_ref], np.frombuffer(lats, dtype=np.float64)[first_ref]
    del lons, lats, first_ref
    x, y = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True).transform(lon, lat)
    x, y = x.astype(np.float32), y.astype(np.float32)
    del lon, lat

    # Edges: every pair of nodes next to each other on a way
    way_start = np.frombuffer(breaks, dtype=np.int64)
    way_end = np.append(way_start[1:], len(node_of))
    is_edge = np.ones(len(node_of), dtype=bool)
    is_edge[way_end - 1] = False  # a way's last node starts no edge
    u, v = node_of[:-1][is_edge[:-1]], node_of[1:][is_edge[:-1]]
    del node_of, is_edge
    way_of_edge = np.repeat(np.arange(len(way_start), dtype=np.int32), way_end - way_start - 1)
    length = np.hypot(x[v] - x[u], y[v] - y[u]).astype(np.float32)
    per_way = np.frombuffer(speeds, dtype=np.float32).reshape(-1, 5).copy()

    # A ferry takes its tagged duration, or its length at FERRY_KMH, and the wait to board: as a
    # speed over its length
    ferries = np.frombuffer(ferry, dtype=np.int64)
    if len(ferries):
        metres = np.bincount(way_of_edge, weights=length, minlength=len(way_start))[ferries]
        tagged = np.frombuffer(ferry_tagged, dtype=np.float64)
        seconds = np.where(tagged >= 0, tagged, metres / (FERRY_KMH / 3.6)) + FERRY_WAIT_S
        per_way[ferries] = np.where(per_way[ferries] > 0, (metres / seconds * 3.6)[:, None], 0)
    is_ferry = np.zeros(len(way_start), dtype=bool)
    is_ferry[ferries] = True

    # Speeds are stored in steps of half a km/h, which is plenty
    per_way_stored = np.clip(np.round(per_way * 2), 0, 255).astype(np.uint8)
    per_way_stored[(per_way > 0) & (per_way_stored == 0)] = 1
    stored = per_way_stored[way_of_edge]
    ferry_edges = int(is_ferry[way_of_edge].sum())

    # Where a trip by car can start: a node on a road that is not a motorway
    can_start = np.zeros(len(ids), dtype=bool)
    starting = (np.frombuffer(starts, dtype=np.int8).astype(bool) & ((per_way_stored[:, 0] | per_way_stored[:, 1]) > 0))[way_of_edge]
    can_start[u[starting]] = True
    can_start[v[starting]] = True
    del way_of_edge, starting, per_way, per_way_stored

    # One edge per pair of nodes, with the fastest way each way: ways can share a stretch. Every
    # edge goes from the lower node to the higher, with car and bike turned around where needed.
    keep = u != v
    u, v, length, stored = u[keep], v[keep], length[keep], stored[keep]
    turn = u > v
    u, v = np.where(turn, v, u), np.where(turn, u, v)
    stored[turn] = stored[turn][:, [1, 0, 3, 2, 4]]
    key = u.astype(np.int64) * len(ids) + v
    order = np.argsort(key, kind="stable")
    key, u, v, length, stored = key[order], u[order], v[order], length[order], stored[order]
    first = np.flatnonzero(np.r_[True, key[1:] != key[:-1]])
    u, v = u[first], v[first]
    length = np.minimum.reduceat(length, first)
    stored = np.maximum.reduceat(stored, first, axis=0)
    del key, order, keep, turn
    counts = {"nodes": int(len(ids)), "edges": int(len(u)), "ferryEdges": ferry_edges}
    np.save(out_dir / "x.npy", x)
    np.save(out_dir / "y.npy", y)
    del x, y, ids
    for mode, (ahead, back) in MODES.items():
        arrays = network(len(can_start), u, v, length, stored[:, ahead], stored[:, back], can_start if mode == "car" else None)
        for name, array_ in arrays.items():
            np.save(out_dir / f"{mode}-{name}.npy", array_)
        counts[f"{mode}Edges"] = int(len(arrays["indices"]))
        counts[f"{mode}Starts"] = int(arrays["start"].sum())
        del arrays
        release()
    (out_dir / "counts.json").write_text(json.dumps(counts), encoding="utf-8")
    release()
    log(f"Built the network in {time.time() - started:.0f} s: " + ", ".join(f"{key} {value:,}" for key, value in counts.items()))
    progress(1)
    return counts


def network(nodes: int, u, v, length, ahead, back, can_start) -> dict[str, np.ndarray]:
    """One mode's network, turned around, as a sparse matrix in seconds, and where trips can start."""
    go_ahead, go_back = ahead > 0, back > 0
    # u → v becomes v → u, and v → u becomes u → v
    rows = np.concatenate([v[go_ahead], u[go_back]])
    cols = np.concatenate([u[go_ahead], v[go_back]])
    half_kmh = np.concatenate([ahead[go_ahead], back[go_back]]).astype(np.float32)
    seconds = np.concatenate([length[go_ahead], length[go_back]]) / (half_kmh / 2 / 3.6)
    del half_kmh
    # A zero would be no edge at all
    matrix = csr_matrix((np.maximum(seconds, 1e-3).astype(np.float32), (rows, cols)), shape=(nodes, nodes))
    del rows, cols, seconds
    # Trips start in the larger networks only
    _, component = connected_components(matrix, directed=True, connection="weak")
    sizes = np.bincount(component)
    used = np.zeros(nodes, dtype=bool)
    used[u[go_ahead | go_back]] = True
    used[v[go_ahead | go_back]] = True
    start = used & (sizes[component] >= min(MIN_NETWORK, sizes.max()))
    if can_start is not None:
        start &= can_start
    # Seconds as half floats, which are close enough and halve the files
    return {"indptr": matrix.indptr.astype(np.int32, copy=False), "indices": matrix.indices.astype(np.int32, copy=False),
            "seconds": matrix.data.astype(np.float16), "start": start}


def cli(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="roads", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pbf", type=Path)
    parser.add_argument("out_dir", type=Path)
    args = parser.parse_args(argv)
    build(args.pbf, args.out_dir)
