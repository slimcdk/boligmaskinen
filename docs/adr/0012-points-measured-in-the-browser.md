# 12. Distances to points a block chooses are measured in the browser

- **Status:** accepted
- **Date:** 2026-10-12
- **Where:** `packages/engine/src/sites.ts`, `siteLayer` in `frontend/src/app/map/heat-engine.ts`,
  `chargers()` in `pipeline/src/boligmaskinen_pipeline/grid.py`;
  [#134](https://github.com/slimcdk/boligmaskinen/pull/134)

## Context

The chargers for electric cars should count by provider: a subscription often ties a driver to
one. The block has a checkbox per provider, eleven and "other", and counts the nearest charger of
those ticked.

## Decision

- **The grid step writes the points,** not layers: `chargers.json` in the data pack, with the
  operators and a point per site (`[lon, lat, operator]`), named in `meta.json` under `sites`.
- **The browser measures the distances** the first time a block reads one of the values
  (`charger`, `charger_<operator>`), with a distance transform (Felzenszwalb and Huttenlocher)
  kept to the 20 km the layers end at, and keeps the result. The 100 m detail tiles take the
  distances from the region's grid.
- **The values are distance layers to the blocks:** the same encoding and the same formulas, so
  `min(clever ? charger_clever : FAR, …)` picks the nearest of those ticked.

## Alternatives

- **A layer per provider in the pack:** twelve more layers would add about 50 MB to what every
  browser holds and loads at the start.
- **A layer per combination of providers:** 4,096 of them.

## Consequences

- Measuring all twelve for Denmark took about 0.7 s when it was built, in the worker, the first
  time a block needs them.
- The same way fits any value where a block chooses among the points of a source; `ValueInfo`'s
  `sites` names the file and the operators.
- The job "Check the data pack" looks for the site files too.
