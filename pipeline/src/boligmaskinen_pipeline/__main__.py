"""Run one step of the pipeline: python -m boligmaskinen_pipeline <step> [arguments].

Steps:
    osm         extract the OpenStreetMap layers and address points
    grid        build every data layer on the grid of the region
    world       build the world map outside Denmark from Natural Earth
    pack        pack the grid, basemap, fonts, sprites, styles and world map into a data pack
    roads       build the road network that travel times are found on
    travel      find the travel times to a place by car, by bike and on foot
    remote-zip  list or extract members of a remote ZIP file with HTTP range requests
"""

import sys

from . import grid, osm, pack, remote_zip, roads, travel, world

STEPS = {"osm": osm.cli, "grid": grid.cli, "world": world.cli, "pack": pack.cli, "remote-zip": remote_zip.cli,
         "roads": roads.cli, "travel": travel.cli}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in STEPS:
        print(__doc__, file=sys.stderr)
        raise SystemExit(2)
    STEPS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
