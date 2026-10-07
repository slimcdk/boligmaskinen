# Findings worth a closer look

Things noticed while building the pilot that could matter later. Each entry says what was
found and what to do about it. Newest first. Started 2026-10-07.

## Data

- **OSM municipalities carry the official municipality code.**
  - What: every Danish municipality relation (admin_level 7) has `ref` = Danmarks
    Statistik's code (Aarhus 751, København 101, Bornholm 400).
  - What: the boundaries follow the coastline; Aarhus is 471 km² against an official 468 km².
  - Use: the union of the 98 municipalities is an accurate land mask (42,514 km² without
    lakes), and statistics join by code instead of by name.
- **The Geofabrik extract has almost no German or Swedish coastline.**
  - What: filling the sea from the coastline, as the East Jutland pilot did, would spill
    over the land border into Germany and on into Jutland.
  - Done: sea is now "inside the national boundary (which includes the territorial sea)
    and not land".
  - Watch: keep this in mind for any coastline-based processing.
- **Miljøstyrelsen's EU noise map covers only 3 % of Danish land.**
  - What: every road is mapped in the four agglomerations (Copenhagen, Aarhus, Odense,
    Aalborg); elsewhere only roads with more than 3 million vehicles a year. The data
    says which is which (`source` = `roadsInAgglomeration`).
  - What: the same archive also holds national maps (`dk_2022_*`) at 1.5 m receiver
    height: larger roads (1.5 GB) and several rail layers. They may cover far more roads
    than the EU layer.
  - Next: evaluate them before refining our own estimate.
- **Plandata's zone map is small.**
  - What: 6,250 polygons for the whole country, one 19 MB WFS request.
  - Next: a natural first nightly job.
- **OSM has 2.6 million address points.**
  - What: they are imported from the national address register (DAR), and the pilot uses
    them as a proxy for homes.
  - Next: DAR and BBR (Datafordeleren) give the real number of dwellings per address, and
    the building type.
- **StatBank's `"*"` includes more than municipalities.**
  - What: it also returns the whole country, the regions and Christiansø (411), and the
    crime table has a few extra codes.
  - Do: always filter to the municipality codes from OSM `ref`.
- **School quality and districts are within reach.**
  - What: uddannelsesstatistik.dk (key) has grades and well-being per school; GeoFA has
    school districts.
  - Use: both fit naturally as blocks ("district school's grades").
- **Datafordeleren's old services close 15 January 2027.**
  - What: the Tinglysning OCES API closes 6 November 2026, and Klimadatastyrelsen merges
    into DMI on 1 December 2026.
  - Do: build new integrations against GraphQL and file downloads only.

## Weighting and frontend

- **Interpreting the formulas costs 23 times more than the language does.**
  - What: one weighting over all Danish land at 100 m (4.25 million cells, 4 blocks), on
    one thread:
    - the prototype's closure interpreter: 2.3 s
    - the same blocks as one generated JavaScript loop: 100 ms
    - NumPy: 144 ms
    - Go: 109 ms
    - Rust: 78 ms
  - Scripts: `docs/benchmarks/weighting/`.
  - So: Node is within 1.3× of Rust once the formulas are compiled.
  - Next: generate code from the block language (on the server always; in the browser
    where the host allows it). Keep the closures as a fallback, with a parity test
    between the two.

- **Every block is code, and the predefined ones still score exactly like the original engine.**
  - What: a test compares them over 2,000 random cells with requirements, categories,
    municipal values and missing data, including the histogram.
  - Use: the user can read and change any block without losing the simple start.
- **The block language is not JavaScript.**
  - What: formulas are compiled to closures, so shared blocks cannot run arbitrary code.
  - Use: the same blocks can run on the server, for nightly alerts.
  - Next: a richer editor, with syntax highlighting and completion of value names.
- **Missing data needs three-valued logic.**
  - What: with plain true/false, `zone == BYZONE` on a cell without data is false, so a
    requirement would remove the cell.
  - Done: comparisons and `&&` / `||` now give "no data" unless the answer is given anyway,
    as in SQL. Requirements never remove a cell for missing data, like the original engine.
- **Distances need a square-root slider.**
  - What: on a straight 0–20 km slider, 300 m sits at the very left.
  - Done: distance sliders now move on a square-root scale; the value in the code is unchanged.
- **National scale is at the edge of what the browser handles comfortably.**
  - What: on the 200 m grid a slider change takes about 200 ms, and the JS heap is about
    240 MB. Smoothing is about 90 ms of that.
  - What: 100 m for the whole country would be 17.6 million cells.
  - Next, either of:
    - Move scoring and drawing to a Web Worker, so the page stays responsive.
    - Move them to WebGL: every criterion is a 256-entry lookup table, so a fragment
      shader can score and colour every pixel in real time at full resolution.
  - Later, the server can pre-render tiles for alerts and sharing.
- **The basemap edge shows outside Denmark.**
  - What: the extract includes whole tiles that touch Denmark, so a rectangular patch of
    detailed map shows over Sweden and Germany at zoom 5–12. Beyond it the map falls back
    to Natural Earth.
  - Next: clipping the tiles or adding a low-zoom world basemap would hide the seam.

## Hosting the prototype as an artifact

- **Only standard web file types are served.** Binary data therefore ships as "byte
  container" PNGs, and the glyphs as JSON.
- **Workers loaded from files are blocked.**
  - What: MapLibre 6 ships its worker as a separate ES module. On the artifact host it
    only starts from a `blob:` URL, so the app fetches the file and starts it as a blob.
  - Also: the map now shows an error banner if it fails to load, instead of staying empty.
- **One publish carries at most 64 MB.**
  - What: the national data pack (86 MB) goes up in two publishes. Parts the live version
    does not use go first, so the page never breaks in between.
- **First load on the host takes 10–20 seconds:** the 7 MB of layers plus the first
  basemap part. Smaller parts (now 5 MB) help, and a real server with HTTP range requests
  would remove the byte-container step entirely.

## Testing

- **WebGL works in headless Chrome**, so Playwright can test the map itself, not only the panel.
- **MapLibre's zoom-out button never turns off.**
  - What: the map stops at the zoom where the world fills the window's height (about 0.8
    at 900 px), not at 0.
  - Do: tests read the zoom from the address (`#map=zoom/lat/lng`) instead.
- **First load on the artifact host took 20–30 seconds** after a new version.
  - What: on a narrow start the panel opened closed.
  - Next: a real server with caching and HTTP range requests fixes the load. The panel's
    start state should be decided after the layout has settled.

## Tooling

- **Angular 22 needs Node 22.22 or newer.** The development machine has Node 20.19
  (end of life), so builds use a temporary Node 24. Installing Node 24 (see `.nvmrc`)
  is the first setup step for the real project.
- **MapLibre 5.13.0 has a critical XSS advisory.** The project uses 6.13.0, which is
  ESM-only and needs named imports and a worker URL.
- **The development disk is almost full** (7 GB free), so raw data and build output
  should not live on it.
