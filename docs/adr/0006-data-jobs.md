# 6. Data jobs: fetch into a raw archive, build, check, switch

- **Status:** accepted
- **Date:** 2026-10-09
- **Where:** `backend/src/pipeline/` (`sources.ts`, `archive.ts`, `builds.ts`, `checks.ts`),
  `backend/src/jobs/`, [`backend/README.md`](../../backend/README.md);
  [#38](https://github.com/slimcdk/boligmaskinen/pull/38),
  [#68](https://github.com/slimcdk/boligmaskinen/pull/68),
  [#71](https://github.com/slimcdk/boligmaskinen/pull/71),
  [#72](https://github.com/slimcdk/boligmaskinen/pull/72),
  [#90](https://github.com/slimcdk/boligmaskinen/pull/90)

## Context

The sources change at their own pace: OpenStreetMap every day, the noise maps every five years.
A new install must build its own data with no manual step. A broken source must not break the
map, and a home server has little memory.

## Decision

- **The backend runs the jobs** on pg-boss in PostGIS, each on a cron schedule in
  `JOB_TIME_ZONE`, and the jobs dialog shows them, their runs and their logs.
- **One fetch job per source** keeps every file it gets unchanged in a raw archive
  (`DATA_DIR/raw/<source>/<date>-run<id>/`, with a row of its URL, licence, size, sha256, ETag and
  Last-Modified). It asks with `If-None-Match` and `If-Modified-Since`, checks what it got before
  keeping it (an error page fails the job and keeps the old file), and starts the builds it feeds
  (`then`).
- **Build jobs** (the grid, the road network, the basemap, the pack) record what they were made
  from (`made-from.json`) and build only when that changed. A new install fetches every source
  and builds from them.
- **The pack is built beside the one in use**, its counts are compared with those of the pack in
  use, and one rename switches it in. When a count changes too much, the old pack stays and the
  job says why; a run by hand switches anyway.
- **Every step fits in about 1 GB** for all of Denmark: large layers are read in parts and parked
  in memory-mapped files.

## Alternatives

- **A one-off script that builds the pack:** what the prototype had; no updates, no history, and
  a broken source breaks the map.
- **Fetching and building in one job per source:** simpler, but every source would rebuild the
  grid, and a source fetched before another would build half a pack.

## Consequences

- A new source is a fetch job plus its place in the grid's inputs. It is optional there, so an
  install that has not fetched it yet still builds ([the guide](../guides/adding-a-data-source.md)).
- The counts in `meta.json` guard against broken sources; a new one should count what it got.
- The raw archive keeps the three newest files of each name, so a bad night can be rebuilt from
  the night before.
