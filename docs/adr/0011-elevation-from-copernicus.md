# 11. The height above sea level from Copernicus until DHM can be had

- **Status:** accepted
- **Date:** 2026-10-12
- **Where:** `fetchElevation` in `backend/src/pipeline/sources.ts`, `elevation()` in
  `pipeline/src/boligmaskinen_pipeline/grid.py`, the value `elevation`;
  [#133](https://github.com/slimcdk/boligmaskinen/pull/133), issue #53

## Context

The owner asked for a weighting by the height of the land. Danmarks Højdemodel (DHM/Terræn) is
exact to the decimetre and is a model of the terrain, but its coverage service needs a
Dataforsyningen token: its WCS answers GetCapabilities without one, not GetCoverage (checked
2026-10-12). A token is free, but someone has to register for it.

## Decision

- **Use the Copernicus elevation model of 30 m (GLO-30)** from AWS's open data, with no key, free
  for any use with its notice. The job "Elevation" fetches the 22 tiles of 1° with Danish land
  (about 310 MB), each once, by its ETag.
- **The model is of the surface,** roofs and treetops too, so the grid takes the first quartile of
  the model's points in each cell: mostly the ground between houses and trees. The sea (0 in the
  model) is no data.
- **The value is `scaled`:** `RAW_STEPS` 1 and `RAW_OFFSET` −10, so −10 to 244 m in whole metres.

## Alternatives

- **Wait for the token:** no value until someone registers.

## Consequences

- Heights in forests and towns read a few metres high; the block's note and "About the data"
  say so.
- With a Dataforsyningen token, DHM can replace it and add the slope: the same value name, so
  blocks keep working; a new ADR then supersedes this one.
