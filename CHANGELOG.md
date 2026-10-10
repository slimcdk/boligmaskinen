# Changelog

What changed in each release of Boligmaskinen, newest first. A release is tagged on GitHub, and
its image is the one CI built and tested from that commit (`ghcr.io/slimcdk/boligmaskinen:<version>`).
"Upgrade notes" say what an update asks of whoever runs it; `docs/self-hosting.md` says how to
update.

## Unreleased

Everything so far: there is no release yet. The test instance follows `master`.

### The map and the weighting

- A full-screen map of all of Denmark: 200 m cells, and the grid's own 100 m cells from zoom 10.
- Blocks in a small, safe language score every cell. Predefined blocks are code too, and a block
  can be turned around. Blocks run as compiled JavaScript in a Web Worker.
- Several maps, groups of blocks that switch on and off, and places with travel times (estimated
  from the distance until routing comes).
- Maps and places are saved on the server, so every browser has them, and a map can be shared as
  a link.
- 15 values of open data: forests, lakes and the sea, beaches, road noise, wind turbines, address
  density, supermarkets, schools, daycare, stations, planning zones, municipal tax, land tax,
  burglaries and population, and air quality (NO₂ and PM2.5).
- Material 3 in light and dark mode, on desktops, tablets and phones. axe finds no WCAG 2.2 AA
  violations in the main views.

### The data

- The app fetches and builds its own data: a job per source, into a raw archive that keeps every
  download with its hash, URL and licence; then the grid, the basemap and the data pack.
- An unchanged source is not fetched or built again. A new pack is built beside the one in use and
  switched in at once, and a pack whose counts changed too much is not switched in.
- The cell size and the region are settings.
- "About the data" credits every source with its licence, and the licence texts are served with
  the fonts and icons.

### Running it

- One image: the app, its API, the data pack and the data pipeline. PostGIS runs beside it.
- Security headers with a strict Content Security Policy; no fonts or scripts from elsewhere.
- A nightly backup of the database, with a tested restore.
- CI tests everything and scans the image; Dependabot proposes updates.

### Upgrade notes

- **The data jobs need memory:** about 4 GB while the data of all of Denmark is built, and about
  2.5 GB for a smaller region (#69).
- **`./data` has to belong to the user the app runs as**: `BOLIGMASKINEN_UID` and
  `BOLIGMASKINEN_GID`, 1000 by default.
- **An instance with a data pack from before the jobs** keeps it, and moves it aside the first
  time the jobs switch in a pack of their own.
