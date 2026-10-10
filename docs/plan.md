# Development plan

How Boligmaskinen goes from the prototype to a product, as milestones with steps.
Started 2026-10-07. Update it when a milestone is done or a decision changes.

**The goal:** a self-hosted, map-first home search for Denmark. It has as much open data
as possible and a fast weighting engine on top, which the user shapes with blocks. The map
shows how well every place fits, and finding homes is the point.

**How to use this plan:**

- Every milestone has a goal, steps and a "done when" check.
- On GitHub, each milestone becomes a milestone and each step an issue, and pull requests
  close the issues. The plan says where we are going; the issues say what is being done
  now.
- Milestones mostly run in order. Track A, the access applications, runs alongside from
  the start, because others decide how long it takes.

## Ground rules

These hold for every milestone.

- **Tests come with the code.** Vitest for logic and components, Playwright for what a
  user does. CI must be green before a merge.
- **One scoring engine.** The same blocks score grid cells and homes, in the browser and
  in the backend. A home inherits its cell's values and adds its own.
- **One image.** The Node backend serves the frontend, the API and the data. PostGIS runs
  next to it, and the data lives in a volume that the jobs fill, not in the image.
- **Only data we may use.** Open sources first. Gated sources only with a legal basis: an
  approved application, a licence, or the user's own key or e-mail. Nothing is scraped
  where the terms forbid it.
- **Personal data.** No owner names and no search by name, after Datatilsynet's 2024
  decision on Boliglag. Sale prices need a GDPR legal basis.
- **Small steps.** Each step leaves the app working and is merged on its own. `master` is always
  ready to run: the test instance runs it.

## Where we are (2026-10-10)

**Done: the prototype (milestone 0), the backend foundation (milestone 1) and the data pipeline
as jobs (milestone 2). Milestone 3 is done but for the sources that need
access; milestone 7 but for a first release. Of milestone 4, scoring in the database is ready for
the homes.**

- All of Denmark: 31 layers of open data on a 100 m grid, shown at 200 m and at 100 m from zoom
  10, with a world map around it. Nature, protected areas and Natura 2000, noise from roads,
  railways, airports and industry, air quality, wind turbines (also by their height), solar parks,
  power lines, airports and airfields, what the plans lay out (roads and railways, new local
  plans, zones around businesses, gravel pits now and to come), district heating, everyday services (also pharmacies and
  libraries), planning zones and municipal statistics (also the income, nursery rates and class sizes).
- The weighting is blocks in our own language ([`block-language.md`](block-language.md)), with
  versions and migrations. Predefined blocks are code too, and a block can be turned around. The
  blocks run as compiled JavaScript in a Web Worker, and compile to SQL for the database.
- Several maps, each with its own blocks in groups that can be switched off. The places are
  shared by the maps; their travel times by car, bike and on foot are found on OSM's roads, and
  by public transport on Rejseplanen's timetables. The maps and places are saved on the server, so every
  browser has them.
- Material 3 in light and dark mode, on desktops, tablets and phones, with a finger's 48 px on
  touch screens; axe finds no WCAG 2.2 AA violations in the main views.
- In Danish and English: the app follows the browser's language, and the footer switches it.
- One image, for amd64 and arm64: the Node backend serves the app, the data pack and the API,
  with PostGIS beside it, and its data jobs fetch every source and build the data pack and the
  road network every night, each step in under 1 GB of memory. A new install builds its own data
  at its first start: checked on 2026-10-10 from `master`, in an empty data folder, for all of
  Denmark under a 1.5 GB memory limit. Every job succeeded in 5½ minutes with no step killed, and
  the first travel times were ready 14 s after a place was added. A guide for running it
  yourself, and a changelog.
- CI runs the engine, frontend, backend, pipeline and end-to-end tests, starts the image and scans
  it; Dependabot proposes updates. Every green commit on `master` is published as `:master`,
  which the test instance on a home server runs.

**Not yet:** data about homes, homes for sale and prices, and alerts, which wait
for the access in Track A.

## Track A: access applications (start now, runs alongside)

Approvals take weeks or months, so they start before the code needs them.

| Access | For | Status and next step |
|---|---|---|
| Datafordeleren user and API key | DAR, BBR, MAT, EBR, VUR (milestone 4) | The login failed. Try again, or create a new web user. Build only against GraphQL and file downloads; the old services close 15 January 2027. |
| EJF via Geodatastyrelsen | Sale prices (milestone 5) | Needs MitID Erhverv, OAuth, a whitelisted IP, a stated purpose and a GDPR legal basis. Ask GST what a private, self-hosted use needs. Råd til Bolig shows that a small company can get access. |
| Listings feed | Homes for sale (milestone 5) | Ask Boligsiden (datasalg) and Geomatic (Udbudsdata) for terms and price. Until then: the user's own search-alert e-mails. |
| Rejseplanen Labs | Public transport times (milestone 3) | Not needed for them (2026-10-10): the GTFS feed is CC BY 4.0 and needs no key, and the travel times are found on it. A key only for the real-time API. |
| uddannelsesstatistik.dk | School grades and well-being (milestone 4) | Apply for a key. |

**Done when** every row has an answer: access, a price, or a no with a fallback.

## Milestone 1: backend foundation (done)

The backend owns the database and the jobs:

- Fastify, with its configuration checked at start.
- PostGIS with SQL migrations that run when the app starts, and a `compose.yaml` for the app
  and the database.
- pg-boss for schedules and runs, and the jobs API that the jobs dialog reads.
- The engine is a package shared by the frontend and the backend.
- The block language is written down, with versions and migrations.

## Milestone 2: the data pipeline as jobs (done 2026-10-10)

**Goal:** the app fetches and builds its own data on schedule. Nothing is built by hand.

What was built is described in `backend/README.md` (the jobs, the raw archive, the builds) and
`pipeline/README.md` (the steps). Then the steps were made to fit in 1 GB of memory, a quarter of
what they took (#69).

1. **Where the pipeline runs (decided 2026-10-09).** The Python steps stay in Python, in
   [`pipeline/`](../pipeline/README.md), and the jobs run them as commands. The jobs themselves,
   and the fetching, are Node.
   - The app image has Python and the steps' packages. It is based on Debian now, because
     geopandas, rasterio and scipy come as wheels for glibc.
   - The image is about 1.2 GB unpacked; Python and its packages are about 0.5 GB of it.
   - A step moves to Node only where that pays off.
2. **Raw archive.** Every fetch is stored unchanged under `/data/raw` with its date, URL,
   size, hash and licence, and a `source_file` row. Change detection (ETag,
   Last-Modified, hash) means unchanged sources are not processed again.
3. **One job per source.** OSM, Plandata, STIL schools and daycare, Energistyrelsen, DST,
   noise, the Protomaps basemap and Natural Earth. "Build the grid", "Basemap" and "Pack the
   data" follow when a source has changed.
4. **Safe updates.** A new data pack is built beside the old one and switched in at once,
   so the app never serves half a pack.
5. **Data checks.** Counts are compared with the previous build, such as the number of
   addresses or schools. A large change (more than a quarter) stops the switch and shows on
   the jobs page; running "Pack the data" by hand switches anyway.
6. **Configuration.** The cell size (`GRID_CELL_METRES`, default 100) and the region are
   settings of the instance.

**Done when:**

- A new install with an empty `/data` fetches everything and shows the map with no
  manual step.
- The nightly jobs keep the data current.

## Milestone 3: the map at full detail and speed (done 2026-10-10, but for the sources that need access)

**Goal:** detail follows the zoom, and the map answers a slider at once.

1. **Compiled blocks.** The engine compiles each block to one JavaScript function. The
   benchmark showed this is 23 times faster than the interpreter. Target: all of Denmark
   at 100 m in under 150 ms. Done (2026-10-10): six times faster, 320 ms for all of Denmark at
   100 m and 71 ms for the map's 200 m grid.
2. **Off the main thread.** The weighting runs in a Web Worker, so the panel never
   stutters. WebGL or WebGPU only if that is not enough. Done (2026-10-10).
3. **Tiles instead of one grid.** The layers are served as a tile pyramid: coarse when
   zoomed out, 100 m from about zoom 10. This replaces the single 200 m grid for the whole
   country. Done (2026-10-10) as two levels: the 200 m grid of the whole country, and 100 m
   detail tiles that the map loads around the view from zoom 10.
4. **Real travel times.**
   - Routing for car, bike and walk on OSM. Decided 2026-10-10: our own network and Dijkstra in
     the pipeline (SciPy) rather than OSRM or Valhalla, which would be a service of their own. One
     search from a place gives the times from every cell, in a few seconds.
   - Public transport from the Rejseplanen GTFS feed. Done (2026-10-10): the feed needs no key. The
     road network job keeps a weekday's timetable beside the roads, and the travel step scans its
     connections back from the place (the connection scan algorithm), walking to the first stop
     and from the last: the time to be there between 7:30 and 8:30, waiting included.
   - When a place is added, the app finds its travel times (`POST /api/travel`). Done
     (2026-10-10) for car, bike and walk, and for public transport the same day; the place says
     whether its times come from the roads and the timetables.
5. **More areas, more values.** The national noise maps, GeoDanmark and the GeoFA school
   districts. Air quality (NO₂ and PM2.5 from DCE) came first, on 2026-10-10. Then energy parks: solar parks came from OpenStreetMap on 2026-10-10 ("Away from solar parks"), and the turbines' size the same day (`turbine_heights`); the designated areas are to come. Airports, airfields and air stations came from OpenStreetMap the same day too, and Miljøstyrelsen's protected areas and Natura 2000 from Danmarks Miljøportal; pharmacies, libraries and the overhead power lines of 132 kV or more from OpenStreetMap, where they are nearly all mapped; and the roads and railways the municipal plans lay out, the local plans of the last two years, the zones around businesses and plants, and the district heating areas, from Plandata.dk; and the areas the regions' raw material plans set aside for digging, now or later, from Danmarks Miljøportal. And
   drinking water quality (hardness per supply area, PFAS, nitrate); see
   [data-sources.md](data-sources.md#sources-not-used-yet-and-what-they-need). The GeoFA school
   districts were fetched on 2026-10-10 (1,409 districts, 143 MB of GeoJSON) but not used: a
   district has a number and a name, not the school's, and some hold several schools or grades,
   so they wait for the school results (Track A, #7), which name the schools. The open public data checked on
   2026-10-09, and where to start, is in [public-data.md](public-data.md). Each new source adds values to the block language, predefined blocks and a
   line in "About the data".

**Done when:**

- Zooming into a town shows 100 m cells.
- A slider updates the map within about 100 ms on an ordinary laptop.
- Travel times come from routing, not estimates.

## Milestone 4: homes

**Goal:** score every home, not only areas.

1. **Registers.** DAR addresses and BBR buildings and units, loaded by jobs into PostGIS:
   type, size, rooms, year and heating.
2. **Homes in the language.** Values such as `area_m2`, `rooms`, `built` and `home_type`
   join the cell's values, so one block can mix the home and its surroundings. The ideas so
   far, such as heating and room to the neighbours, are in [`block-ideas.md`](block-ideas.md).
3. **The best homes.** A list of the best homes for the current weighting, each with its
   points per block, linked to the map. Homes are drawn as points from about zoom 13.
4. **More about the property.** MAT, VUR (valuations), EBR, and school grades from
   uddannelsesstatistik.dk.
5. **Scoring in the database.** The engine compiles blocks to SQL as well, so PostGIS can
   find the best homes among millions without sending them to the browser. Done (2026-10-10):
   `blockSql` and `weightingSql` in `packages/engine/src/sql.ts`; a test against PostGIS gives
   2,000 rows the same values and points as the browser, for every predefined block and for
   every operator and function.

**Done when:** the panel shows the 50 best homes for the current weighting, each with an
explanation.

## Milestone 5: homes for sale and prices

**Goal:** know which homes are for sale, and at what price.

1. **Listings from the user's own e-mail.** A job reads the user's search-alert e-mails
   (IMAP) and links each listing to its DAR address.
2. **A licensed feed**, when Track A has one. It replaces or supplements the e-mails.
3. **Sale prices from EJF**, when access is approved, or a paid provider. Prices per
   address, with the legal basis documented.
4. **For sale on the map and in the list.** Price, price per m², days on the market and
   price changes.

**Done when:** a new listing that matches shows up within a day, with its price and points.

## Milestone 6: alerts and saved weightings

**Goal:** Boligmaskinen watches for you.

1. **Alerts** on absolute points ("tell me when a home for sale gets 80 points"), by
   e-mail (SMTP) or push (ntfy or Web Push). The maps they watch are already saved on the server.
2. **Share a weighting** as a link. Done (2026-10-10): "Share this map" gives a link with the
   map's blocks, its view and the places it uses.

**Done when:** a new listing above the threshold sends a notification.

## Milestone 7: ready for others to run

**Goal:** someone else can install, run and trust it.

- **Danish interface.** Every text goes through translation keys. Transloco allows
  switching language in the app; choose before the texts multiply. Done (2026-10-10): Danish
  and English, after the browser's language, with a switch in the footer.
- **Accessibility, WCAG 2.2 AA.** Keyboard use, labels, and contrast in both themes.
  axe runs in Playwright. Done (2026-10-10).
- **Security and upkeep:** done (2026-10-10).
  - Content Security Policy and security headers.
  - Dependabot for npm and Actions.
  - Image scanning.
  - Images for both amd64 and arm64.
- **Backups.** A nightly PostGIS dump job, and restoring is documented. Done (2026-10-10).
- **Running it.** Self-hosting guide, upgrade notes, and a changelog per release. The guide
  and the changelog are written (2026-10-10); the first release is still to come.
- **Licences.** OSM-derived data is under ODbL, so check the share-alike duty for what we
  publish (see "Licences and credits" in `data-sources.md`). Every source is credited in "About the
  data", and the licence texts are served with the fonts and icons. Done (2026-10-10).

**Done when:** a fresh install from the guide works on another machine, and a release has
notes.

## Later: users

Login (OIDC) and a profile per person, if several people share one instance. Postponed by
decision on 2026-10-07; until then an instance has one user.

## Version 1.0

Milestones 1 to 6, and the essentials of 7: the Danish interface, backups and the
self-hosting guide.

## Open decisions

| Decision | When | Leaning |
|---|---|---|
| Python in the app image, or a separate job image | Milestone 2, step 1 | In the image, so there is one image |
| Tile format for the layers (vector tiles or raw byte tiles) | Milestone 3 | Raw byte tiles, which the engine reads directly |
| Routing engine | Milestone 3 | OSRM for speed; Valhalla if isochrones are needed |
| Listings source and budget | Track A | E-mails first, then a licence |
| Who applies for EJF, and for what purpose | Track A | Ask GST first |
| Translation framework | Before milestone 7 | Transloco |
