# Adding a data source

How a new source becomes a value that blocks can read: from checking its licence to the layer in
the data pack, the value in the block language and the line in "About the data". Read
[ADR 2](../adr/0002-only-data-we-may-use.md) (only data we may use),
[ADR 4](../adr/0004-a-grid-of-cells-in-a-data-pack.md) (the grid and the data pack) and
[ADR 6](../adr/0006-data-jobs.md) (the data jobs) first.

A predefined block for the new value is the next step: [Adding a weighting](adding-a-block.md).
The two usually go in one pull request, with the tests of every part they touch.

The examples are the chargers for electric cars (#134, points from a WFS), the hardness of the
drinking water (#131, areas from a file), the building lines (#132, areas through the area
table) and the height above sea level (#133, a raster).

## 1. Check that we may use it

- **The licence, on the provider's own page:** may we copy it, change it and show it, and how does
  it ask to be credited? Quote the page and keep its address. "No licence stated" can be fine for
  a public register; say so.
- **The access:** open (no key) is best. A source that needs a key or an account belongs in Track
  A of [the plan](../plan.md), and the user registers, not the code.
- **Personal data:** none (no owner names; see ADR 2).
- **How big, and how often new:** this decides the job's schedule, and whether the step fits in
  1 GB.

Write it into [`docs/data-sources.md`](../data-sources.md) as you find it: a candidate under "Sources
not used yet, and what they need", or under "Looked at and set aside" with the reason.

## 2. Fetch it: a job

In `backend/src/pipeline/sources.ts`:

1. **`SOURCE_URLS`** gets the address (the tests replace it with a local server), and
   **`LICENCES`** the licence and credit the raw archive records with each file.
2. **A fetch function.** Reuse the helpers:
   - a WFS: a `WfsLayer` (`name`, `layer`, `properties` to take only the fields the grid reads,
     `filter` for CQL, and a `check`) and `fetchWfs`, as `fetchChargers` does;
   - a file or a set of files: see `fetchWater` and `fetchElevation`;
   - only some layers of a large ZIP: `remote-zip` with range requests, as `fetchNoise` does.

   **The `check` throws** on an answer that cannot be right (an error page, too few features: set
   a floor well below the real count) and returns a short summary for the log, such as
   `35,661 chargers`. A file that fails keeps the old one.
3. **An entry in `SOURCES`:** `id`, `name`, `source` (the provider), `schedule` (cron in
   `JOB_TIME_ZONE`; the nightly fetches sit between 3:00 and 4:00, the weekly and monthly ones
   mostly at 4:00 or 5:00), `then` (usually `['grid']`) and a `description` of what it fetches.
4. **The jobs dialog without a backend** lists the jobs from `frontend/src/app/admin/jobs.ts`
   (`JOBS`): add the job there too, and raise the row count in `jobs-dialog.spec.ts`.
5. **Tests** in `backend/test/sources.test.ts`, with a small fixture in `backend/test/sources/`:
   the job keeps the file, and a broken answer fails it.

## 3. Hand it to the grid

In `backend/src/pipeline/builds.ts`, **`OPTIONAL_GRID_SOURCES`** maps the key the grid step reads
in its `inputs.json` to the job and the file name in the raw archive. A new source is always
optional there: an install that has not fetched it yet still builds, without the layer, and a
block that reads it says it has no data.

## 4. Make the layer: the grid step

In `pipeline/src/boligmaskinen_pipeline/grid.py`:

1. **`OPTIONAL_INPUTS`** gets the key, so `read_inputs` passes the file (or a list of files).
2. **Choose the kind** and its encoding into one byte per cell (ADR 4):

   | The value | Kind | How |
   |---|---|---|
   | Distance to points or lines | `distance` | burn them, then the distance transform; `encode_distance` (square root up to 20 km). See the pharmacies and libraries |
   | Distance to areas, 0 inside | `distance` | a row in `AREA_LAYERS` (`AreaLayer` and `AreaSource`, with `keep` to select features), nothing else to write |
   | A measure per area or a raster | `scaled` | `1 + round((value − offset) · steps)`, 0 for no data; add the layer's steps and offset to `RAW_STEPS` and `RAW_OFFSET` in the engine. See `water_hardness` and `elevation` |
   | How many within a radius | `count` | see `density` and `departures` |
   | A number per municipality | `municipal` | a field in `municipalities.json`, from Danmarks Statistik; see `income` |
   | Points a block chooses among, such as by provider | `sites` | write the points instead of a layer ([ADR 12](../adr/0012-points-measured-in-the-browser.md)) |

3. **`LAYERS`** gets the layer's name, before `"mask"`.
4. **Count what it got** into `meta.json`'s `counts` (the number of features, or of cells with a
   value), and only when the source was there. `backend/src/pipeline/checks.ts` names each count
   in `NAMES`; the pack job compares them with the pack in use and keeps the old pack when one
   falls by more than a quarter.
5. **Log a line** with what it did (`step(...)`), and keep it in memory: read large files in
   parts (`read_chunks`), park finished layers (`ParkedLayers`), and give memory back between
   parts (`memory.py`).
6. **From OpenStreetMap?** Add a theme in `osm.py` (the tags it takes and the columns it keeps).
   The jobs build again what an older revision of the app built, so after an update the `osm`
   step runs again the next time its job does.
7. **Tests** in `pipeline/tests/test_grid.py`, with a made-up source in `conftest.py`: the layer's
   bytes where the source is, no data where it is not, and the count.

`pack.py` copies every layer and every points file (`sites`) that `meta.json` names, and the job
"Check the data pack" (`backend/src/jobs/data-pack.ts`) looks for each of them.

## 5. Make it a value: the engine

In `packages/engine/src/`:

1. **`types.ts`:** the layer's name in `LayerName`; for `scaled`, its `RAW_STEPS` and `RAW_OFFSET`.
2. **`values.ts`:** an entry in `DATA_VALUES`: `name` (what code calls it, in snake_case),
   `label` (`Distance to a pharmacy`), `unit`, `group` (the catalogue group), `kind`, and `layer`
   (or `field` for a municipal value).
3. **The name is for good.** Once released, renaming a value needs a new language version and a
   migration ([ADR 5](../adr/0005-blocks-in-our-own-language.md)). A new value is an addition and
   needs neither. Give a predefined block the same id as its value.
4. **[`docs/block-language.md`](../block-language.md)** lists the values: add it under "Values".

## 6. Name it in both languages, and credit it

1. **`frontend/src/i18n/en.json` and `da.json`:** `values.<name>` (the label), and any new unit
   in `words`. `texts.spec.ts` fails until `da.json` has it; `npm test` first checks that both
   catalogues have the same keys.
2. **"About the data":** a source the app did not use before gets an entry in `SOURCES`
   (`frontend/src/app/panel/about-dialog.ts`): what the map takes from it, its licence with a
   link, its credit as it asks, and a note on what we changed (put on the 100 m cells, our own
   calculation). Its Danish is in `da.json` under `about.sources.<id>`. A source already there
   gets its `uses` extended.
3. **The README's "Data sources"** gets a row `| [<name>](<url>) | … | … |` with the same name and
   link as `SOURCES`; `frontend/tools/check-readme.mjs` fails the tests until it is there.
4. **The job's Danish** goes in `da.json` under `jobs.byId.<id>` (`name` and `description`).

## 7. The test data pack

The end-to-end tests run on a small pack for Aarhus Kommune in `frontend/e2e/data-pack`. Rebuild it
with the new layer as [`pipeline/README.md`](../../pipeline/README.md) says ("the test data pack",
`--region aarhus`), or add the layer's file and its lines in `meta.json`. Then extend an
end-to-end test that adds the new block and sees the map change.

## 8. Write it down

- [`docs/data-sources.md`](../data-sources.md): the row under "Sources in use" (the data, the
  source and access, the licence, the size and cadence, how we fetch it), the row in "Licences and
  credits", and the candidate's row removed.
- [`docs/block-ideas.md`](../block-ideas.md): mark the idea done, with the date and the value.
- `CHANGELOG.md` (Unreleased: the number of values and what is new), the status in
  [`docs/plan.md`](../plan.md) and in the README (the number of layers), and the pipeline's
  README when its inputs change.
- [`docs/self-hosting.md`](../self-hosting.md) when the downloads, the disk or the memory change.

## 9. Check it for all of Denmark

The tests use made-up data. Before the pull request is merged:

- **Fetch the real source** and run the grid step for all of Denmark with every other input, as
  [`pipeline/README.md`](../../pipeline/README.md) shows, under `/usr/bin/time -v`: the maximum
  resident size must stay under about 1 GB (memory-mapped layers count in it), and say how long it
  took.
- **Look at the layer:** its counts, the share of cells with a value, a few places you know.
- **Say in the pull request** what you measured.

The test instance is updated only when its owner asks
([ADR 13](../adr/0013-images-releases-test-instance.md)).
