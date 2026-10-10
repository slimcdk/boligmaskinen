"""Public transport on a weekday, from a GTFS feed: the timetable the travel step routes on.

Reads a GTFS feed (Rejseplanen's has every operator in Denmark), picks the busiest Tuesday,
Wednesday or Thursday of its first four weeks, so not a school holiday, and writes that day's
timetable into a road network's folder (roads.py), beside the walk network it is reached on:

- transit-dep-stop.npy, transit-arr-stop.npy, transit-dep.npy, transit-arr.npy, transit-trip.npy:
  the day's connections, each from one stop to the next of a trip, in seconds after midnight,
  the latest arrival first, as the travel step scans them;
- transit-buffer.npy: per stop, the seconds to be there before a departure, to change or board;
- transit-foot-indptr.npy, transit-foot-from.npy, transit-foot-seconds.npy: the footpaths into
  each stop, from the feed's transfers and from the stops within FOOTPATH_M;
- transit-stop-nodes.npy, transit-stop-metres.npy: each stop's nearest nodes of the walk network
  (-1 where none is within STOP_MAX_M);
- transit.json: the day, and how much there is.

Services that run only when booked (route type 715) are left out. The travel step scans the
connections back from a time to be at a place (latest_departures).

Usage:
    python -m boligmaskinen_pipeline transit <GTFS.zip> <network_dir>
"""

import argparse
import datetime
import io
import json
import time
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Transformer
from scipy.spatial import cKDTree

from .progress import log, progress

# Booked services ("Demand and response bus service"): no timetable to rely on
DEMAND_RESPONSIVE = "715"
# The days of the week the timetable may come from, and how far into the feed to look
WEEKDAYS = {1, 2, 3}
SEARCH_DAYS = 28
DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
# Stops this close are joined by a footpath, walked at WALK_MPS on a way DETOUR times as long
FOOTPATH_M = 300
WALK_MPS = 5 / 3.6
DETOUR = 1.3
# To board or change at a stop, one is there this long before the departure, or the feed's own
# minimum time to change at the stop, up to BUFFER_MAX_S
BUFFER_S = 60
BUFFER_MAX_S = 600
# The nearest walk nodes of a stop, and how far they may be
STOP_NEAREST = 4
STOP_MAX_M = 500


def read(feed: zipfile.ZipFile, name: str, **kwargs) -> pd.DataFrame:
    """A file of the feed as text columns; an empty frame when the feed lacks it."""
    if name not in feed.namelist():
        return pd.DataFrame(columns=kwargs.get("usecols", []))
    return pd.read_csv(io.TextIOWrapper(feed.open(name), encoding="utf-8-sig"), dtype=str, keep_default_na=False, **kwargs)


def seconds(times: pd.Series) -> np.ndarray:
    """H:MM:SS as seconds after midnight; past 24:00 for trips that run on after midnight."""
    parts = times.str.split(":", expand=True).astype(np.int32)
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]).to_numpy(np.int32)


def services_on(calendar: pd.DataFrame, dates: pd.DataFrame, day: datetime.date) -> set[str]:
    """The services that run on a day: by the week in calendar.txt, with calendar_dates.txt's exceptions."""
    text = day.strftime("%Y%m%d")
    on = set()
    if len(calendar):
        weekly = calendar[(calendar["start_date"] <= text) & (calendar["end_date"] >= text) & (calendar[DAY_NAMES[day.weekday()]] == "1")]
        on = set(weekly["service_id"])
    today = dates[dates["date"] == text]
    return (on | set(today[today["exception_type"] == "1"]["service_id"])) - set(today[today["exception_type"] == "2"]["service_id"])


def busiest_weekday(calendar: pd.DataFrame, dates: pd.DataFrame, trips: pd.DataFrame) -> datetime.date:
    """The Tuesday, Wednesday or Thursday of the feed's first weeks with the most trips; the first of equals."""
    starts = [*calendar.get("start_date", []), *dates.get("date", [])]
    if not starts:
        raise SystemExit("The feed has neither calendar.txt nor calendar_dates.txt")
    first = datetime.datetime.strptime(min(starts), "%Y%m%d").date()
    per_service = trips.groupby("service_id").size()
    best, most = None, -1
    for offset in range(SEARCH_DAYS):
        day = first + datetime.timedelta(days=offset)
        if day.weekday() not in WEEKDAYS:
            continue
        count = int(per_service.reindex(list(services_on(calendar, dates, day))).fillna(0).sum())
        if count > most:
            best, most = day, count
    if best is None or most <= 0:
        raise SystemExit(f"The feed has no trips on a weekday in the {SEARCH_DAYS} days from {first}")
    return best


def footpaths(stop_xy: np.ndarray, stop_index: dict[str, int], transfers: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The footpaths into every stop, as a sparse table by the stop walked to: (indptr, from, seconds).
    They join the stops within FOOTPATH_M both ways, and the feed's transfers between two stops."""
    pairs = cKDTree(stop_xy).query_pairs(FOOTPATH_M, output_type="ndarray")
    metres = np.hypot(*(stop_xy[pairs[:, 0]] - stop_xy[pairs[:, 1]]).T)
    walked = metres * DETOUR / WALK_MPS
    origin = [pairs[:, 0], pairs[:, 1]]
    target = [pairs[:, 1], pairs[:, 0]]
    duration = [walked, walked]
    if len(transfers):
        plain = transfers[(transfers["transfer_type"] == "2") & (transfers["from_stop_id"] != transfers["to_stop_id"])]
        for column in ("from_route_id", "to_route_id", "from_trip_id", "to_trip_id"):
            if column in plain:
                plain = plain[plain[column] == ""]
        known = plain["from_stop_id"].isin(stop_index) & plain["to_stop_id"].isin(stop_index)
        plain = plain[known]
        origin.append(plain["from_stop_id"].map(stop_index).to_numpy(np.int64))
        target.append(plain["to_stop_id"].map(stop_index).to_numpy(np.int64))
        duration.append(pd.to_numeric(plain["min_transfer_time"], errors="coerce").fillna(0).to_numpy(np.float64))
    origin, target, duration = np.concatenate(origin), np.concatenate(target), np.concatenate(duration)
    # The shortest of each pair, sorted by the stop walked to
    order = np.lexsort((duration, origin, target))
    origin, target, duration = origin[order], target[order], duration[order]
    first = np.ones(len(order), dtype=bool)
    first[1:] = (origin[1:] != origin[:-1]) | (target[1:] != target[:-1])
    origin, target, duration = origin[first], target[first], duration[first]
    indptr = np.searchsorted(target, np.arange(len(stop_xy) + 1)).astype(np.int32)
    return indptr, origin.astype(np.int32), np.ceil(duration).astype(np.int32)


def buffers(stop_count: int, stop_index: dict[str, int], transfers: pd.DataFrame) -> np.ndarray:
    """The seconds to be at each stop before a departure: BUFFER_S, or the feed's time to change there."""
    buffer = np.full(stop_count, BUFFER_S, dtype=np.int32)
    if len(transfers):
        same = transfers[(transfers["from_stop_id"] == transfers["to_stop_id"]) & transfers["from_stop_id"].isin(stop_index)]
        times = pd.to_numeric(same["min_transfer_time"], errors="coerce").fillna(0).to_numpy(np.int64)
        np.maximum.at(buffer, same["from_stop_id"].map(stop_index).to_numpy(np.int64), np.minimum(times, BUFFER_MAX_S).astype(np.int32))
    return buffer


TIMETABLE = ["dep-stop", "arr-stop", "dep", "arr", "trip", "buffer", "foot-indptr", "foot-from", "foot-seconds", "stop-nodes", "stop-metres"]


def load(network: Path) -> dict[str, np.ndarray] | None:
    """The timetable in a network's folder, as memory maps; None when the network has none."""
    if not (network / "transit.json").exists():
        return None
    return {name: np.load(network / f"transit-{name}.npy", mmap_mode="r") for name in TIMETABLE}


def latest_departures(timetable: dict[str, np.ndarray], egress: np.ndarray, deadline: int, window: int) -> np.ndarray:
    """The latest time one can be at each stop and still reach the place by `deadline`, in seconds
    after midnight, or -inf. `egress` is the walk from each stop to the place (inf where it is too far).

    The connection scan algorithm, run backwards: the connections that arrive by the deadline, the
    latest first, back to `window` seconds before it. A connection is taken if one can get off at
    its next stop in time for what comes after, or stay on, as its trip is taken later; then one
    can be at its stop up to that stop's buffer before it leaves, or at a stop with a footpath to it.
    """
    latest = (deadline - egress).tolist()
    arr_all = timetable["arr"]
    # Latest arrival first: the slice that arrives within the window before the deadline
    first = int(np.searchsorted(-arr_all, -deadline, side="left"))
    last = int(np.searchsorted(-arr_all, -(deadline - window), side="right"))
    dep_stop, arr_stop = timetable["dep-stop"][first:last].tolist(), timetable["arr-stop"][first:last].tolist()
    dep, arr, trip = timetable["dep"][first:last].tolist(), timetable["arr"][first:last].tolist(), timetable["trip"][first:last].tolist()
    buffer = timetable["buffer"].tolist()
    foot_indptr, foot_from, foot_seconds = timetable["foot-indptr"].tolist(), timetable["foot-from"].tolist(), timetable["foot-seconds"].tolist()
    on = bytearray(max(trip, default=-1) + 1)
    for i in range(len(dep)):
        k = trip[i]
        if on[k] or arr[i] <= latest[arr_stop[i]]:
            on[k] = 1
            stop = dep_stop[i]
            at = dep[i] - buffer[stop]
            if at > latest[stop]:
                latest[stop] = at
                for j in range(foot_indptr[stop], foot_indptr[stop + 1]):
                    near = foot_from[j]
                    walked = at - foot_seconds[j]
                    if walked > latest[near]:
                        latest[near] = walked
    return np.array(latest, dtype=np.float64)


def build(feed_path: Path, network: Path) -> dict:
    """Write the timetable of a weekday into the network's folder; returns what transit.json says."""
    started = time.time()
    feed = zipfile.ZipFile(feed_path)
    calendar = read(feed, "calendar.txt")
    dates = read(feed, "calendar_dates.txt", usecols=["service_id", "date", "exception_type"])
    routes = read(feed, "routes.txt", usecols=["route_id", "route_type"])
    trips = read(feed, "trips.txt", usecols=["route_id", "service_id", "trip_id"])
    trips = trips.merge(routes, on="route_id", how="left")
    trips = trips[trips["route_type"] != DEMAND_RESPONSIVE]
    day = busiest_weekday(calendar, dates, trips)
    trips = trips[trips["service_id"].isin(services_on(calendar, dates, day))]
    trip_index = {trip_id: index for index, trip_id in enumerate(trips["trip_id"])}
    log(f"Timetable of {day.isoformat()} ({DAY_NAMES[day.weekday()].title()}): {len(trip_index):,} trips")
    progress(0.2)

    stops = read(feed, "stops.txt", usecols=["stop_id", "stop_lat", "stop_lon"])
    stop_index = {stop_id: index for index, stop_id in enumerate(stops["stop_id"])}
    x, y = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True).transform(
        stops["stop_lon"].astype(float).to_numpy(), stops["stop_lat"].astype(float).to_numpy())
    stop_xy = np.column_stack([x, y])

    # The day's stop times, a quarter of a million at a time
    parts = []
    for chunk in pd.read_csv(io.TextIOWrapper(feed.open("stop_times.txt"), encoding="utf-8-sig"), dtype=str, keep_default_na=False,
                             usecols=["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"], chunksize=250_000):
        chunk = chunk[chunk["trip_id"].isin(trip_index) & chunk["stop_id"].isin(stop_index)
                      & (chunk["arrival_time"] != "") & (chunk["departure_time"] != "")]
        parts.append(np.column_stack([chunk["trip_id"].map(trip_index).to_numpy(np.int32), chunk["stop_sequence"].astype(np.int32).to_numpy(),
                                      chunk["stop_id"].map(stop_index).to_numpy(np.int32), seconds(chunk["arrival_time"]), seconds(chunk["departure_time"])]))
    times = np.concatenate(parts) if parts else np.zeros((0, 5), dtype=np.int32)
    del parts
    times = times[np.lexsort((times[:, 1], times[:, 0]))]
    trip, stop, arrival, departure = times[:, 0], times[:, 2], times[:, 3], times[:, 4]
    # A connection is a trip's way from one stop to the next
    same = (trip[1:] == trip[:-1]) & (arrival[1:] >= departure[:-1])
    connections = {"dep-stop": stop[:-1][same], "arr-stop": stop[1:][same], "dep": departure[:-1][same], "arr": arrival[1:][same], "trip": trip[:-1][same]}
    del times
    # The latest arrival first, and of those the latest departure
    order = np.lexsort((-connections["dep"].astype(np.int64), -connections["arr"].astype(np.int64)))
    for name, values in connections.items():
        np.save(network / f"transit-{name}.npy", np.ascontiguousarray(values[order], dtype=np.int32))
    count = len(order)
    del connections, order, trip, stop, arrival, departure, trips
    progress(0.6)

    transfers = read(feed, "transfers.txt")
    indptr, origin, duration = footpaths(stop_xy, stop_index, transfers)
    np.save(network / "transit-foot-indptr.npy", indptr)
    np.save(network / "transit-foot-from.npy", origin)
    np.save(network / "transit-foot-seconds.npy", duration)
    np.save(network / "transit-buffer.npy", buffers(len(stops), stop_index, transfers))

    # Each stop's nearest nodes of the walk network
    starts = np.flatnonzero(np.load(network / "walk-start.npy"))
    nodes_x, nodes_y = np.load(network / "x.npy", mmap_mode="r"), np.load(network / "y.npy", mmap_mode="r")
    tree = cKDTree(np.column_stack([nodes_x[starts], nodes_y[starts]]))
    k = min(STOP_NEAREST, len(starts))
    metres, index = tree.query(stop_xy, k=k, workers=-1)
    del tree
    metres, index = metres.reshape(len(stops), k), index.reshape(len(stops), k)
    stop_nodes = np.where(metres <= STOP_MAX_M, starts[index], -1).astype(np.int32)
    np.save(network / "transit-stop-nodes.npy", stop_nodes)
    np.save(network / "transit-stop-metres.npy", metres.astype(np.float32))
    progress(0.9)

    validity = [*calendar.get("end_date", []), *dates.get("date", [])]
    summary = {
        "day": day.isoformat(), "until": datetime.datetime.strptime(max(validity), "%Y%m%d").date().isoformat(),
        "stops": len(stops), "trips": len(trip_index), "connections": count, "footpaths": len(origin),
        "stopsOffFoot": int((stop_nodes[:, 0] < 0).sum()),
    }
    (network / "transit.json").write_text(json.dumps(summary), encoding="utf-8")
    log(f"{summary['connections']:,} connections between {summary['stops']:,} stops, {summary['footpaths']:,} footpaths; "
        f"{summary['stopsOffFoot']:,} stops more than {STOP_MAX_M} m from a path ({time.time() - started:.0f} s)")
    progress(1.0)
    return summary


def cli(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="transit", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("feed", type=Path, help="the GTFS feed, a ZIP file")
    parser.add_argument("network", type=Path, help="the road network's folder, as the roads step writes it")
    args = parser.parse_args(argv)
    if not (args.network / "walk-start.npy").exists():
        parser.error(f"{args.network} has no walk network: run the roads step first")
    build(args.feed, args.network)
