# Boligmaskinen

A self-hosted, map-first home search for Denmark. A full-screen map shows how well every
place fits what you care about. The weighting is a list of blocks, each a small formula over
open data, with sliders like free values in GeoGebra.

**Status:** prototype. The backend so far only serves the app; the frontend runs on a
precomputed data pack built by the pilot pipeline.

| Folder | What it is |
|---|---|
| [`frontend/`](frontend/README.md) | Angular 22 + Angular Material app: the map, the blocks and their code, the data jobs, light and dark mode. Vitest and Playwright tests. |
| [`backend/`](backend/README.md) | Node 24 + Fastify server that serves the frontend, the data pack and the API. |
| [`packages/engine/`](packages/engine/README.md) | The scoring engine and the block language, shared by the frontend and the backend. |
| [`pilot/`](pilot/README.md) | Python pipeline that fetches the open data for all of Denmark and builds the grid and the data pack. |
| [`docs/`](docs) | [The development plan](docs/plan.md), [the block language](docs/block-language.md), [block ideas for home data](docs/block-ideas.md), [data sources and how they are fetched](docs/data-sources.md), [findings](docs/findings.md), [benchmarks](docs/benchmarks/weighting/README.md). |
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

Without the dev container, Node 24 is needed (`frontend/.nvmrc`), and uv for the pilot.

## Running it

One image runs the whole app: the backend serves the frontend, the data pack and the API on
port 8080. PostGIS runs next to it. `compose.yaml` starts both:

```sh
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" > .env
mkdir -p data && cp -r /path/to/data-pack data/data-pack
docker compose up -d                 # http://localhost:8080
```

The data pack is not in the image; the app reads it from `./data/data-pack`. `BOLIGMASKINEN_TAG`
picks the image: `master` (the default) is the newest build, and a release has its version, such
as `v0.1.0`.

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
