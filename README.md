# Boligmaskinen

[![CI](https://github.com/slimcdk/boligmaskinen/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/slimcdk/boligmaskinen/actions/workflows/ci.yml?query=branch%3Amaster)
[![Unit tests](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslimcdk%2Fboligmaskinen%2Fbadges%2Ftests.json)](https://github.com/slimcdk/boligmaskinen/actions/workflows/ci.yml?query=branch%3Amaster)
[![End-to-end tests](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslimcdk%2Fboligmaskinen%2Fbadges%2Fe2e.json)](https://github.com/slimcdk/boligmaskinen/actions/workflows/ci.yml?query=branch%3Amaster)
[![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslimcdk%2Fboligmaskinen%2Fbadges%2Fcoverage.json)](#ci-and-releases)
[![Docker image](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslimcdk%2Fboligmaskinen%2Fbadges%2Fimage.json)](https://github.com/slimcdk/boligmaskinen/pkgs/container/boligmaskinen)
[![Last commit](https://img.shields.io/github/last-commit/slimcdk/boligmaskinen/master)](https://github.com/slimcdk/boligmaskinen/commits/master)

A self-hosted, map-first home search for Denmark. A full-screen map shows how well every place
fits what you care about. You say what that is with blocks: small formulas over open data, whose
numbers become sliders.

![The map of a family that wants forest, water, quiet, high ground, schools, daycare, shops, trains and EV chargers close by, over Aarhus, Silkeborg, Randers and Horsens: green where a home fits it best, red where least](docs/screenshots/map.webp)

**Status:** prototype. It covers all of Denmark with 35 layers of open data on a 100 m grid, in
Danish and English, and keeps several maps of blocks. Its data jobs fetch the sources and build
the data themselves, every night, and find the travel times to your places on OpenStreetMap's
roads and Rejseplanen's timetables. Still to come: data about homes and homes for sale
([milestones 4 and 5](docs/plan.md#milestone-4-homes)), which wait for access to their sources,
and a first release. [The plan](docs/plan.md#where-we-are-2026-10-10) says
where it stands.

| Folder | What it is |
|---|---|
| [`frontend/`](frontend/README.md) | Angular 22 + Angular Material app: the map, several saved maps, the blocks in groups and their code, the data jobs, light and dark mode, on phones too. Vitest and Playwright tests. |
| [`backend/`](backend/README.md) | Node 24 + Fastify server that serves the frontend, the data pack and the API. |
| [`packages/engine/`](packages/engine/README.md) | The scoring engine and the block language, shared by the frontend and the backend. |
| [`pipeline/`](pipeline/README.md) | The Python steps that build the grid and the data pack from the open data, for all of Denmark or a region. The app image runs them. |
| [`docs/`](docs) | [The development plan](docs/plan.md), [the block language](docs/block-language.md), [block ideas](docs/block-ideas.md), [data sources and how they are fetched](docs/data-sources.md), [public data to add](docs/public-data.md), [Plandata's themes](docs/plandata.md), [OpenData.dk's datasets](docs/opendata-dk.md), [Danmarks Statistik's tables](docs/dst.md), [findings](docs/findings.md), [benchmarks](docs/benchmarks/weighting/README.md). |
| [`.devcontainer/`](.devcontainer) | The development environment: Node 24, uv, go-pmtiles, Playwright's Chromium and psql, next to a PostGIS database. |

## Screenshots

<table>
  <tr>
    <td><img src="docs/screenshots/denmark.webp" width="320" alt="All of Denmark coloured by the same map, in dark mode"><br>All of Denmark, in dark mode</td>
    <td><img src="docs/screenshots/block.webp" width="320" alt="The block EV charger opened in the panel, with a checkbox for each provider of chargers"><br>A block's sliders and checkboxes: whose chargers count</td>
    <td rowspan="2"><img src="docs/screenshots/phone.webp" width="200" alt="The map of Aarhus on a phone, in Danish, with half the panel showing the blocks"><br>On a phone, in Danish</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/code.webp" width="320" alt="The code of the block EV charger, next to the values a block can read"><br>A block's code, in the block language</td>
    <td><img src="docs/screenshots/catalogue.webp" width="320" alt="The dialog What matters to you?, which lists the predefined blocks by group"><br>What matters to you: the predefined blocks</td>
  </tr>
</table>

They are taken of the test instance by `npm run screenshots` in `frontend/` (see its README).

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
port 8080, and runs the data jobs. PostGIS runs next to it. `compose.yaml` starts both;
[`docs/self-hosting.md`](docs/self-hosting.md) is the full guide (install, settings, updates,
backups, troubleshooting), and [`CHANGELOG.md`](CHANGELOG.md) has the release notes:

```sh
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" > .env
mkdir data                           # as the user the app runs as, uid 1000 by default
docker compose up -d                 # http://localhost:8080
```

- **The data builds itself.** A new install has no data. At its first start the jobs fetch every
  source, and the grid, the basemap and the data pack follow; for all of Denmark that takes about
  ten minutes. The data jobs (the gear in the panel) show how far they are.
- **What it needs:**
  - about 1 GB of downloads the first time;
  - 4 GB of disk in `./data`;
  - about 1 GB of memory while the data is built, for a few minutes a night.
- **Settings:** `REGION` and `GRID_CELL_METRES` choose the area and the cell size (see
  `backend/README.md`).
- **The image:** `BOLIGMASKINEN_TAG` picks it. `master` (the default) is the newest build, and a
  release has its version, such as `v0.1.0`.

![The dialog Data jobs: each source with its schedule, when it last ran and what it found, and when it runs next](docs/screenshots/jobs.webp)

### Licences

The data comes with duties, which "About the data" in the app lists source by source.

- **Credits.** Every source is credited there, with its licence. OpenStreetMap's credit is also on
  the map until it is first used.
- **The ODbL.** An instance that only its owner uses publishes nothing. One that is open to others
  must offer the database made from OpenStreetMap (the data layers of the pack) or the way it is
  made: the source of `pipeline/` and `backend/src/pipeline/`, as the ODbL 4.6 says.
- **Licence texts.** The data pack serves the licence texts of the map's fonts and icons in
  `licences/`. The app serves those of its own fonts and of its libraries in `/licences/`
  (`docs/data-sources.md`).

### Backups

Every night at 01:30 the job "Back up the database" dumps the database into `./data/backups/`
(pg_dump's custom format; the newest seven are kept). The database holds the maps, the places
and the history of the data jobs; the data pack and the raw archive are rebuilt by the jobs.
Copy `./data/backups/` somewhere else to keep it safe.

Restoring a dump replaces the database:

```sh
docker compose stop app
docker compose exec db dropdb -U boligmaskinen boligmaskinen
docker compose exec db createdb -U boligmaskinen boligmaskinen
docker compose run --rm --no-deps --entrypoint sh app -c \
  'pg_restore --no-owner --no-privileges --dbname "$DATABASE_URL" /data/backups/20261010T013000Z.dump'
docker compose start app
```

The app finds its migrations applied and recreates its job queue at start. The backend's tests
restore a dump this way into an empty database.

## CI and releases

GitHub Actions (`.github/workflows/`):

- **Every push and pull request:** engine tests, frontend unit tests and build, backend tests against
  PostGIS, pipeline tests, the end-to-end tests in Chrome with the test data pack, and the image
  started with `compose.yaml` and checked.
- **Coverage:** the unit tests measure which lines they run, with Vitest's V8 coverage for the
  engine, the frontend and the backend, and coverage.py for the pipeline. Each job's summary
  gives the share.
- **The badges** at the top come from the branch `badges`. After every run on master, the job
  "Badges" writes there the results of the tests and of the image, and the coverage, as
  shields.io endpoint files (`.github/scripts/badges.mjs`). The branch has one commit, which
  each run replaces. A part whose tests fail keeps the coverage it had. Per part:
  ![Engine coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslimcdk%2Fboligmaskinen%2Fbadges%2Fcoverage-engine.json)
  ![Frontend coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslimcdk%2Fboligmaskinen%2Fbadges%2Fcoverage-frontend.json)
  ![Backend coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslimcdk%2Fboligmaskinen%2Fbadges%2Fcoverage-backend.json)
  ![Pipeline coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslimcdk%2Fboligmaskinen%2Fbadges%2Fcoverage-pipeline.json)
- **The image is scanned** with Trivy for known vulnerabilities that have a fix. The high ones are
  reported in the job's log; a critical one stops the build. (go-pmtiles 1.31.2, the newest, is
  built with an older Go, which accounts for most of the high ones.)
- **Dependabot** proposes updates weekly: npm, the pipeline's uv lock, the GitHub Actions and the
  Docker base images (`.github/dependabot.yml`). CI tests them like any other pull request.
- **Every commit on master that passes:** the image is built once, for amd64 and arm64, and
  pushed as `ghcr.io/slimcdk/boligmaskinen:sha-<commit>`, also tagged `master`. arm64 is built
  under QEMU, so a pull request that changes what goes into the image (the Dockerfile, the
  backend's or the pipeline's packages) also builds it for arm64 and starts it there
  (`arm64.yml`).
- **A published release** (tag e.g. `v0.1.0`) builds nothing. It gives the images of the
  released commit their version with crane: only the version label and `APP_VERSION` change,
  the layers stay the ones that were tested. They are tagged with the version (and
  `<version>-amd64`, `<version>-arm64`) and, unless it is a pre-release, `latest`. The footer then shows the version, which the running
  container reports at `/api/version`.
- **Changes to `.devcontainer/`** build the dev container and check its tools and database.
