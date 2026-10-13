"""Run one step of the pipeline: python -m boligmaskinen_pipeline <step> [arguments].

Steps:
    osm         extract the OpenStreetMap layers and address points
    grid        build every data layer on the grid of the region
    world       build the world map outside Denmark from Natural Earth
    pack        pack the grid, basemap, fonts, sprites, styles and world map into a data pack
    roads       build the road network that travel times are found on
    transit     add a weekday's public transport timetable to the road network, from a GTFS feed
    travel      find the travel times to a place by car, by bike, on foot and by public transport
    terrain     make the tiles the map shades the land with, from the elevation model
    remote-zip  list or extract members of a remote ZIP file with HTTP range requests
"""

import sys

from . import grid, osm, pack, remote_zip, roads, terrain, transit, travel, world

STEPS = {"osm": osm.cli, "grid": grid.cli, "world": world.cli, "pack": pack.cli, "remote-zip": remote_zip.cli,
         "roads": roads.cli, "transit": transit.cli, "travel": travel.cli, "terrain": terrain.cli}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in STEPS:
        print(__doc__, file=sys.stderr)
        raise SystemExit(2)
    STEPS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
