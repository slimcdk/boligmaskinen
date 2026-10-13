# 14. The background "Terrain" from our own tiles of the Copernicus model

- **Status:** accepted
- **Date:** 2026-10-13
- **Where:** `pipeline/src/boligmaskinen_pipeline/terrain.py`, `buildTerrain` in
  `backend/src/pipeline/builds.ts`, the layer `terrain` in `frontend/src/app/map/map-view.ts`;
  issue #53

## Context

The owner asked for other map views, such as the elevation and aerial photos (#53). In flat
Denmark the shape of the land says much about where one lives: a valley, a slope, a ridge. The
national terrain model (DHM) and the hillshade and orthophoto services on Dataforsyningen need a
token that nobody has registered for yet ([ADR 11](0011-elevation-from-copernicus.md)), and the
app loads nothing from other servers ([ADR 9](0009-nothing-from-other-servers.md)).

## Decision

- **Our own terrain tiles,** from the Copernicus model the app already fetches for the value
  `elevation`: the step `terrain` warps its 22 tiles onto Web Mercator tiles of 512 px over the
  region, from zoom 5 to 11 (22 m a pixel at 56° N, as fine as the model), as Terrarium in lossless
  WebP, in one PMTiles archive. Heights are rounded to 0.25 m, finer than the model is right, so
  the tiles pack smaller.
- **A job "Terrain"** builds it after the elevation model or the grid's outline changed, and the
  pack carries it in parts like the basemap (`meta.json`'s `terrain`).
- **The map draws it as a hillshade** over the heatmap and under the roads and the names, when the
  map settings' background is "Terrain". Which background is chosen stays with each browser, as
  the other map settings do. A pack without the tiles has no such choice.

## Alternatives

- **Dataforsyningen's hillshade or DHM:** exact and of the terrain alone, but they need the token,
  and their tiles would come from another server or through the backend.
- **A hillshade from the grid's own `elevation` layer:** no new tiles, but at 100 m and in whole
  metres it draws terraces.
- **3D terrain** (MapLibre's `setTerrain`): possible with the same tiles later; it tilts the map,
  which the heatmap's canvas does not follow well.

## Consequences

- The model is of the surface: forests and towns stand out a little, as raised ground with edges.
- For all of Denmark the job takes about 3 minutes and 0.3 GB, and writes 950 tiles of 72 MB; the
  pack and the disk grow by as much (two terrains and three packs are kept).
- With a Dataforsyningen token, DHM can replace the model in the same step: the tiles, the job and
  the map stay as they are. Aerial photos would be a third background, through the backend.
