# Boligmaskinen

A self-hosted, map-first home search for Denmark. A full-screen map shows how well every place
fits what you care about. You say what that is with blocks: small formulas over open data, whose
numbers become sliders.

**Status:** prototype. It covers all of Denmark with 13 layers of open data and keeps several maps
of blocks. Its data jobs fetch the sources and build the data themselves, every night. Still to
come: the map at full detail ([milestone 3](docs/plan.md#milestone-3-the-map-at-full-detail-and-speed))
and data about homes ([milestone 4](docs/plan.md#milestone-4-homes)).

| Folder | What it is |
|---|---|
| [`frontend/`](frontend/README.md) | Angular 22 + Angular Material app: the map, several saved maps, the blocks in groups and their code, the data jobs, light and dark mode, on phones too. Vitest and Playwright tests. |
| [`backend/`](backend/README.md) | Node 24 + Fastify server that serves the frontend, the data pack and the API. |
| [`packages/engine/`](packages/engine/README.md) | The scoring engine and the block language, shared by the frontend and the backend. |
| [`pipeline/`](pipeline/README.md) | The Python steps that build the grid and the data pack from the open data, for all of Denmark or a region. The app image runs them. |
| [`docs/`](docs) | [The development plan](docs/plan.md), [the block language](docs/block-language.md), [block ideas](docs/block-ideas.md), [data sources and how they are fetched](docs/data-sources.md), [public data to add](docs/public-data.md), [Plandata's themes](docs/plandata.md), [OpenData.dk's datasets](docs/opendata-dk.md), [Danmarks Statistik's tables](docs/dst.md), [findings](docs/findings.md), [benchmarks](docs/benchmarks/weighting/README.md). |
| [`.devcontainer/`](.devcontainer) | The development environment: Node 24, uv, go-pmtiles, Playwright's Chromium and psql, next to a PostGIS database. |

## Getting started

The easiest way is the dev container: open the repository in VS Code and pick "Reopen in
Container". It installs every dependency and starts PostGIS (`DATABASE_URL` is set).

```sh
cd frontend
npm install
npm start            # http://localhost:4200, with the data pack in public/data-pack (see frontend/README.md)
npm test             # Vitest
npm run e2e          # Playwright, with the test data pack in e2e/data-pack
```

Without the dev container, Node 24 is needed (`frontend/.nvmrc`), and uv for the pipeline.

## Running it

One image runs the whole app: the backend serves the frontend, the data pack and the API on
port 8080, and runs the data jobs. PostGIS runs next to it. `compose.yaml` starts both:

```sh
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" > .env
docker compose up -d                 # http://localhost:8080
```

- **The data builds itself.** A new install has no data. At its first start the jobs fetch every
  source, and the grid, the basemap and the data pack follow; for all of Denmark that takes about
  ten minutes. The data jobs (the gear in the panel) show how far they are.
- **What it needs:**
  - about 1 GB of downloads the first time;
  - 3 GB of disk in `./data`;
  - about 4 GB of memory while the grid is built (see #69).
- **Settings:** `REGION` and `GRID_CELL_METRES` choose the area and the cell size (see
  `backend/README.md`).
- **The image:** `BOLIGMASKINEN_TAG` picks it. `master` (the default) is the newest build, and a
  release has its version, such as `v0.1.0`.

## CI and releases

GitHub Actions (`.github/workflows/`):

- **Every push and pull request:** engine tests, frontend unit tests and build, backend tests against
  PostGIS, the end-to-end tests in Chrome with the test data pack, and the image started with
  `compose.yaml` and checked.
- **Every commit on master that passes:** the image is built once and pushed as
  `ghcr.io/slimcdk/boligmaskinen:sha-<commit>`, also tagged `master`.
- **A published release** (tag e.g. `v0.1.0`) builds nothing. It gives the image of the
  released commit its version with crane: only the version label and `APP_VERSION` change,
  the layers stay the ones that were tested. It is tagged with the version and, unless it
  is a pre-release, `latest`. The footer then shows the version, which the running
  container reports at `/api/version`.
- **Changes to `.devcontainer/`** build the dev container and check its tools and database.
