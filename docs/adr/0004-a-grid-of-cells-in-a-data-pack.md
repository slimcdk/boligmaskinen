# 4. Score a grid of cells, carried to the browser as one byte per cell

- **Status:** accepted
- **Date:** 2026-10-07; the 100 m detail tiles came on 2026-10-10
- **Where:** `pipeline/src/boligmaskinen_pipeline/grid.py` and `pack.py`,
  `packages/engine/src/types.ts` (`LayerName`, `RAW_STEPS`, `RAW_OFFSET`) and `engine.ts`
  (`decodeValue`), `frontend/src/app/map/detail.ts`;
  [#71](https://github.com/slimcdk/boligmaskinen/pull/71),
  [#75](https://github.com/slimcdk/boligmaskinen/pull/75)

## Context

The map shows how well every place in Denmark fits, and answers a slider at once. The weighting
runs in the browser, over values that must already be there: the distance to the nearest
forest, the noise, the municipality's tax.

## Decision

- **The unit is a cell** of a grid, `GRID_CELL_METRES` (100 m by default). Homes, when they come,
  take their cell's values and add their own.
- **A value is a layer of one byte per cell**, a PNG in the data pack's `data/`, decoded by its kind
  (`decodeValue`):

  | Kind | Byte | Value |
  |---|---|---|
  | `distance` | `round(255 · √(min(m, 20 km) / 20 km))` | metres, finest near 0 |
  | `scaled` | `1 + round((value − offset) · steps)`; 0 means no data | `(byte − 1) / steps + offset`, with `RAW_STEPS` and `RAW_OFFSET` per layer |
  | `count`, `category` | the number itself | |
  | `municipal` | the municipality's index | a field of `municipalities.json` |
  | `noise` | dB, plus 100 where Miljøstyrelsen mapped it rather than our own estimate | `byte % 100` |

- **All of Denmark is shown at 200 m**, and from zoom 10 the map loads tiles of 256 × 256 cells at
  the grid's own 100 m around the view.
- **The data pack** holds the layers, `meta.json` (the files, the counts and the region), the
  basemap, the world map, the fonts, the sprites and the styles. The browser loads it from the
  app's own server.

## Alternatives

- **Vector tiles for the layers:** the plan's open decision was taken for raw byte tiles, which
  the engine reads directly with nothing to decode but one formula.
- **Scoring on the server for each view:** a round trip for every slider move.
- **Floats per cell:** four times the bytes, for precision the sources do not have.

## Consequences

- A value must fit in a byte. Choose its kind, and for `scaled` its steps and offset, so its range
  fits: `offset` to `offset + 254 / steps`. Distances end at 20 km.
- A new layer adds a few MB to the pack and to what every browser loads at the start, so a value
  for a choice among many points is measured in the browser instead
  ([ADR 12](0012-points-measured-in-the-browser.md)).
- The engine scores homes with the same formulas, in the database
  ([ADR 5](0005-blocks-in-our-own-language.md)).
