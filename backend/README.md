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
- **After a job succeeds**, the jobs in its `then` start.
- **A job is a function** that gets a context: `log(text)`, `progress(fraction)`, a `signal` that
  aborts when the run is cancelled, and the data pack folder. It returns `{ result, bytes }`.
- **For now one job does real work:** "Check the data pack" reads the data pack and checks that every
  file it names is there. The fetch and build jobs are listed as not built yet, and come with
  milestone 2; the jobs that need access say what they wait for.

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
| `/data-pack/…` | The data pack, from `DATA_PACK_DIR`. |
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
| `DATA_PACK_DIR` | none | The data pack. Without it, the frontend's build has to contain one (`public/data-pack`). The image uses `/data/data-pack`. |
| `DATABASE_URL` | none | PostgreSQL with PostGIS, e.g. `postgres://user:password@db:5432/boligmaskinen`. |
| `JOB_TIME_ZONE` | `Europe/Copenhagen` | The time zone of the job schedules. |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`. The logs are JSON lines. |
| `APP_VERSION`, `APP_REVISION`, `APP_SOURCE`, `APP_CREATED` | empty | The release tag, commit, repository URL and build time. CI sets the last three when it builds the image, and a release sets `APP_VERSION` on the same image. |

API errors all have the same shape, `{"statusCode": 404, "error": "Not Found", "message": "…"}`. The
message is meant for the person using the app; a server error only says that it happened, and the
log has the details. A wrong setting stops the backend at start with a list of what to fix.
