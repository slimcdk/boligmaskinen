# Boligmaskinen

A self-hosted, map-first home search for Denmark. A full-screen map shows how well every
place fits what you care about. The weighting is a list of blocks, each a small formula over
open data, with sliders like free values in GeoGebra.

**Status:** prototype. There is no backend yet; the frontend runs on a precomputed data pack
built by the pilot pipeline.

| Folder | What it is |
|---|---|
| [`frontend/`](frontend/README.md) | Angular 22 + Angular Material app: the map, the blocks and their code, the data jobs. Vitest and Playwright tests. |
| [`pilot/`](pilot/README.md) | Python pipeline that fetches the open data for all of Denmark and builds the grid and the data pack. |
| [`docs/`](docs) | [Data sources and how they are fetched](docs/data-sources.md), [findings](docs/findings.md), [benchmarks](docs/benchmarks/weighting/README.md). |

## Getting started

```sh
cd frontend
npm install
npm start            # needs the data pack in public/data-pack (see frontend/README.md)
npm test             # Vitest
npm run e2e          # Playwright
```

Node 22.22 or newer is required (see `frontend/.nvmrc`).
