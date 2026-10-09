# Boligmaskinen backend

One Node server for the whole app: it serves the built frontend, its data pack and the API from
one port. The app image (`../Dockerfile`) runs it, so a single image is the whole app; PostGIS runs
next to it as its own container when the backend starts using it.

The API tells which version is running and how the database is, keeps the user's maps and places,
and runs the data jobs. The vector tiles and the data itself come next (see `../docs/plan.md`).

## Run

Node 24 runs the TypeScript sources directly (type stripping), so there is no build step.
`npm run typecheck` checks the types.

```sh
npm install
(cd ../frontend && npm run build)    # the server serves frontend/dist/frontend/browser
npm run dev                          # http://localhost:8080, restarts on changes
npm test                             # Vitest; the database tests need TEST_DATABASE_URL (see below)
npm run typecheck
```

## Data jobs

The jobs that fetch and build the data, like the task lists in Sonarr or Overseerr. They are defined
in `src/jobs/definitions.ts`, with the shapes in `src/jobs/types.ts` (the frontend has the same).

- **pg-boss** queues them in PostgreSQL, in its own `pgboss` schema, in the same process as the
  server. Each job has a queue that runs one run at a time and retries nothing: a failed run shows
  in the dialog.
- **Schedules** are cron expressions in `JOB_TIME_ZONE`. Switching a job off removes its schedule;
  the choice is kept in `job_setting`.
- **Runs** are kept in `job_run` with their status, progress, result, size and log. A run that was
  going on when the app stopped is marked as failed at the next start.
- **After a job succeeds**, the jobs in its `then` start, unless it found nothing new
  (`changed: false`). A job started that way may wait for its own run that is still going on, so
  a change made meanwhile is not missed.
- **A job is a function** that gets a context: `log(text)`, `progress(fraction)`, a `signal` that
  aborts when the run is cancelled, the database, the run's id and trigger, and `busy(jobIds)`,
  which says which of those jobs wait or run now. It returns `{ result, bytes, changed }`.
- **"Check the data pack"** reads the data pack and checks that every file it names is there.
- **A job per source** (`src/pipeline/sources.ts`) fetches it into the raw archive: OpenStreetMap,
  Plandata's zones, STIL's schools and daycare, Energistyrelsen's wind turbines, Danmarks
  Statistik's tables, Miljøstyrelsen's road noise and Natural Earth. The OSM job also takes the
  layers and addresses out of the extract, and the world job builds the world map, with the
  pipeline's steps.
- **Three jobs build the data pack** (`src/pipeline/builds.ts`), each only when what it is made
  from changed:
  - **Build the grid** reads the newest file of every source and builds the layers on the grid of
    the region (`REGION`, `GRID_CELL_METRES`). While a fetch runs, it leaves the build to that one,
    so a night of changed sources builds the grid once.
  - **Basemap** cuts the region's tiles up to zoom 12 out of Protomaps' newest planet build with
    go-pmtiles, and adds the fonts, sprites and styles (from `@protomaps/basemaps`). After a new
    grid it only follows a changed outline; a newer planet build comes on its weekly schedule.
  - **Pack the data** packs the grid, the basemap and the world map in `DATA_DIR/packs/<id>`, beside
    the pack in use, and switches `DATA_DIR/data-pack` to it in one rename. The three newest packs
    stay. A pack from before the jobs (a folder, not a link) moves aside the first time.
- **The order:** a fetch that found something new starts the grid, the grid starts the basemap,
  and the basemap starts the pack. The world map starts the pack directly.
- **A new install** has no data pack, so at its first start every fetch job runs, and the builds
  follow.
- The jobs that need access say what they wait for.

## The raw archive

Every file the jobs fetch is kept unchanged under `DATA_DIR/raw/<source>/<date>-run<id>/`, with a
row in `source_file`: where it came from, its licence, size, sha256, the server's ETag and
Last-Modified, and the run (`src/pipeline/archive.ts`).

- **The next fetch asks first.** It sends `If-None-Match` and `If-Modified-Since`, so an
  unchanged source answers 304 and nothing is fetched. For the 2 GB noise archive a `HEAD` decides.
- **Content decides, not bytes.** A file with the content of the newest one is not kept again. A
  source can leave out of the comparison what changes with every answer, such as the time stamp
  GeoServer puts in its GeoJSON.
- **A wrong answer is not kept.** Each source checks what it got (JSON with features, a CSV with the
  export's columns, a ZIP file), and a failed check fails the job and keeps the old file.
- **Files that belong together** (a shapefile) are kept together in one folder.
- **The newest three** files of each name are kept; older ones are deleted, and their rows stay.
- **What is built from a source** (the OSM layers, the world map) is built in a new folder beside
  the old one and switched in with a symbolic link, `work/<what>/current`
  (`src/pipeline/versions.ts`). A `made-from.json` says from which files and which version of the
  app, so it is built again only when one of them changed.

## The pipeline's steps

The jobs run the Python steps in `../pipeline` (`python -I -m boligmaskinen_pipeline <step>`) from
`src/pipeline/python.ts`. Their output goes to the job's log, `@progress` lines move the progress
bar, and a step that fails fails the job with its last error line. One step runs at a time, because
they need a lot of memory: the OSM step about 2.2 GB, the grid of all of Denmark about 3.7 GB.

## Saved maps and places

The user's maps (each with its blocks and groups) and places, so every browser has them. There is one
profile per instance until there are users. The code is in `src/profile/store.ts`, with the shapes in
`../packages/engine/src/profile.ts`, which the frontend shares.

- **Tables:** `saved_map` (blocks and groups as JSON) and `place`, whose `geom` is a PostGIS point
  for the travel-time jobs to come. `profile` has the `epoch`, made with the database, and the
  `revision`, which counts every change.
- **Versions:** every map and place has one, raised with each change. A change names the version it
  was made from, and a change from an older version is a conflict (409). Then nothing in that save is
  kept, and the answer has the versions the server has, so the device can decide and save again.
- **Saves are all or none,** one at a time. Deleting what is already gone is fine.
- **The ETag** is the epoch and the revision, so a page that asks every half minute gets `304` when
  nothing changed.
- **What the frontend does** with it (when it saves, how it merges, who wins) is in
  `../frontend/README.md`.
- The API takes JSON only. Browsers send JSON to another site only after asking (CORS), and this
  server does not answer that, so other web pages cannot change the maps.

## Database

PostgreSQL with PostGIS. `DATABASE_URL` points at it; without it the app runs, and the parts that
need the database say so.

- At start the backend waits up to a minute for the database, then applies the migrations.
- **Migrations** are the SQL files in `migrations/`, applied in the order of their names
  (`0001_postgis.sql`, `0002_…`), each once and in its own transaction.
  - They only go forward: a mistake is fixed by a new migration, never by editing an applied one.
  - An advisory lock lets only one instance migrate at a time.
  - `schema_migration` records what has been applied.
- **Tests** that need the database create a database of their own on `TEST_DATABASE_URL` (or
  `DATABASE_URL`, as in the dev container) and drop it afterwards. Without a server they are
  skipped, except in CI, where they must run.

## Endpoints

| Path | What it serves |
|---|---|
| `/` and the app's own paths | The frontend; unknown paths get `index.html`, because the app is a single page. Hashed bundles may be cached for good. |
| `/data-pack/…` | The current data pack, from `DATA_PACK_DIR`: the frontend reads its `data/meta.json` here, uncached. The pack is looked up once per request, so a file comes whole from one pack while the jobs switch to the next. |
| `/data-packs/<id>/…` | A pack the jobs built, by the id its `meta.json` names, as long as it is kept. Its files never change, so they may be cached for good; the frontend reads everything but `meta.json` from here, so a pack switched in meanwhile does not mix with the one it loaded. |
| `/api/version` | Which version is running, from the `APP_*` variables, named like the OCI image labels. Without them it answers 404 and the frontend reads its own `build-info.json`. |
| `GET /api/jobs` | The data jobs and their latest 100 runs with logs: `{ jobs, runs }`. The data-jobs dialog reads it every 2 seconds while it is open. |
| `POST /api/jobs/:id/run` | Starts a job now: 202 with the queued run, or 409 when it is blocked, switched off or already running. |
| `PATCH /api/jobs/:id` | `{ "enabled": false }` switches a job's schedule off, `true` on again. |
| `POST /api/runs/:id/cancel` | Cancels a waiting run at once and a running one at its next check. |
| `GET /api/profile` | The maps and places: `{ epoch, revision, maps, places }`, each map and place with its `version`. With `If-None-Match` and an unchanged profile it answers 304. |
| `POST /api/profile/changes` | Saves `{ changes: [{ kind, id, base, value }] }`: `kind` is `map` or `place`, `base` the version it was changed from (null for a new one), and a null `value` deletes. Answers `{ revision, saved }` with the new versions, or 409 with `conflicts` and nothing saved. |
| `/api/health` | `{"status":"ok","database":"ok"}`, for the image's health check. The database is `ok`, `not configured` or `unreachable`; unreachable answers 503. |

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT`, `HOST` | `8080`, `0.0.0.0` | Where the server listens. |
| `STATIC_DIR` | `../frontend/dist/frontend/browser` | The built frontend. |
| `DATA_PACK_DIR` | `$DATA_DIR/data-pack` | The data pack, or the link to it. Without it and `DATA_DIR`, the frontend's build has to contain one (`public/data-pack`). The image uses `/data/data-pack`. |
| `DATA_DIR` | none | Where the data jobs keep the raw archive (`raw/`), what they build (`work/`) and their temporary files (`tmp/`). It has to be an absolute path. Without it the jobs that fetch and build say so and do not run. The image uses `/data`. |
| `PIPELINE_PYTHON` | `../pipeline/.venv/bin/python` | The Python that has the pipeline installed (`uv sync` in `../pipeline`). The image has it at `/app/pipeline/.venv/bin/python`. |
| `PMTILES` | `pmtiles` | go-pmtiles, which cuts the basemap. The image has it. |
| `REGION` | `denmark` | The area the data covers: `denmark`, `oestjylland`, `aarhus`, or municipality codes such as `751,706`. |
| `GRID_CELL_METRES` | `100` | The size of the grid's cells, from 10 to 1000 m. The map shows 200 m cells for all of Denmark and 100 m for a smaller region, never finer than the grid. |
| `DATABASE_URL` | none | PostgreSQL with PostGIS, e.g. `postgres://user:password@db:5432/boligmaskinen`. |
| `JOB_TIME_ZONE` | `Europe/Copenhagen` | The time zone of the job schedules. |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`. The logs are JSON lines. |
| `APP_VERSION`, `APP_REVISION`, `APP_SOURCE`, `APP_CREATED` | empty | The release tag, commit, repository URL and build time. CI sets the last three when it builds the image, and a release sets `APP_VERSION` on the same image. |

API errors all have the same shape, `{"statusCode": 404, "error": "Not Found", "message": "…"}`. The
message is meant for the person using the app; a server error only says that it happened, and the
log has the details. A wrong setting stops the backend at start with a list of what to fix.
