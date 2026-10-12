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
- Several maps, groups of blocks that switch on and off, and places with travel times.
- Travel times by car, by bike and on foot are found on OpenStreetMap's roads, paths and ferries,
  for every cell of the map, and by public transport on Rejseplanen's timetables: the time to be
  at the place between 7:30 and 8:30 on a weekday, waiting included. Each place says when they
  are; until then they are estimated from the distance.
- Maps and places are saved on the server, so every browser has them, and a map can be shared as
  a link.
- 51 values of open data: forests, lakes and the sea, beaches, protected areas and Natura 2000,
  building lines, noise (of roads, railways, airports and industry), roads and railways to come, new
  local plans, zones around businesses and plants, gravel pits (now and to come), wind turbines (by
  distance, and by their height), solar parks, overhead power lines, airports, airfields and air
  stations, address density, supermarkets, schools, daycare, stations, departures of public
  transport nearby, pharmacies, libraries, public chargers for electric cars (of any provider, or of
  the providers a block ticks), planning zones, district heating, municipal tax, land
  tax, burglaries, population, income, nursery rates and class sizes, air quality (NO₂ and PM2.5),
  the hardness of the drinking water, and the height above sea level.
- Material 3 in light and dark mode, on desktops, tablets and phones. axe finds no WCAG 2.2 AA
  violations in the main views.
- In Danish or English: the app follows the browser's language, and the footer switches it.

### The data

- The app fetches and builds its own data: a job per source, into a raw archive that keeps every
  download with its hash, URL and licence; then the grid, the basemap and the data pack.
- An unchanged source is not fetched or built again. A new pack is built beside the one in use and
  switched in at once, and a pack whose counts changed too much is not switched in.
- The cell size and the region are settings.
- A national build fits in 1 GB of memory.
- "About the data" credits every source with its licence, and the licence texts are served with
  the fonts and icons.

### Running it

- One image, for amd64 and arm64: the app, its API, the data pack and the data pipeline.
  PostGIS runs beside it.
- Security headers with a strict Content Security Policy; no fonts or scripts from elsewhere.
- A nightly backup of the database, with a tested restore.
- CI tests everything, measures the unit tests' coverage and scans the image; Dependabot proposes
  updates. The README shows the results as badges, and screenshots of the test instance.

### Upgrade notes

- **The data jobs need memory:** about 1 GB while the data is built, a few minutes a night (#69).
- **`./data` has to belong to the user the app runs as**: `BOLIGMASKINEN_UID` and
  `BOLIGMASKINEN_GID`, 1000 by default.
- **An instance with a data pack from before the jobs** keeps it, and moves it aside the first
  time the jobs switch in a pack of their own.
