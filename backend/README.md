# Boligmaskinen backend

One Node server for the whole app: it serves the built frontend, its data pack and the API from
one port. The app image (`../Dockerfile`) runs it, so a single image is the whole app; PostGIS runs
next to it as its own container when the backend starts using it.

For now the API tells which version is running and how the database is. The data jobs and the
vector tiles come next (see `../docs/plan.md`).

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
