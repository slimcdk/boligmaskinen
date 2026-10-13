# 3. One image for the app, its API, its data jobs and the pipeline

- **Status:** accepted
- **Date:** 2026-10-07; the pipeline joined the image on 2026-10-09
- **Where:** `Dockerfile`, `compose.yaml`, [`docs/self-hosting.md`](../self-hosting.md);
  [#1](https://github.com/slimcdk/boligmaskinen/pull/1),
  [#35](https://github.com/slimcdk/boligmaskinen/pull/35),
  [#67](https://github.com/slimcdk/boligmaskinen/pull/67),
  [#89](https://github.com/slimcdk/boligmaskinen/pull/89),
  [#90](https://github.com/slimcdk/boligmaskinen/pull/90)

## Context

Boligmaskinen is self-hosted, often on a home server such as a NAS. It should be one thing to
install and update. Its data is large, changes every night, and is built from many sources by
Python's geo stack (geopandas, rasterio, SciPy).

## Decision

- **One image** (`ghcr.io/slimcdk/boligmaskinen`, for amd64 and arm64): a Node 24 and Fastify
  backend that serves the built Angular app, the API and the data pack on port 8080, and runs the
  data jobs.
- **The pipeline is in the same image:** the Python steps in a uv environment, and go-pmtiles
  for the basemap. The jobs run them as commands (`python -m boligmaskinen_pipeline <step>`).
  Node does the jobs and the fetching; a step moves to Node only where that pays off.
- **PostGIS runs beside it**, as `compose.yaml` sets up.
- **The data lives in a volume** (`DATA_DIR`, `/data`) that the jobs fill, never in the image.
- **The base is `node:24-trixie-slim`,** because the geo packages come as glibc wheels.
- **Every step fits in about 1 GB of memory** for all of Denmark, so the app runs in a 1.5 GB
  container.

## Alternatives

- **A separate image for the jobs:** smaller app image, but two things to run, version and keep
  in step. The plan's open decision was taken for one image.
- **Alpine:** smaller, but the geo stack would have to be built from source.

## Consequences

- The image is large (the geo stack); an update replaces all of it.
- App, API and pipeline always have the same version, so a data pack and the app that reads it
  match.
- A new step or source must stay inside the memory budget; measure it for all of Denmark
  ([the guide](../guides/adding-a-data-source.md#9-check-it-for-all-of-denmark)).
