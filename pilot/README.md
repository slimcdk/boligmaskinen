# Boligmaskinen pilot: location heatmap for Denmark

A location-suitability heatmap for all of Denmark (or the original 11-municipality pilot
around Aarhus). It is built only from open data, on a 100 m grid aligned to Det Danske
Kvadratnet. Every cell gets a value per criterion, and the frontend turns those values into
points with the weighting groups the user builds.

## Pipeline

```sh
uv sync
pipeline/download.sh "$WORK"                     # all sources into $WORK/raw
uv run python -I pipeline/extract_osm.py "$WORK/raw/osm/denmark-latest.osm.pbf" "$WORK/work/osm" \
    "$WORK/work/osm/layers.gpkg" "$WORK/work/osm/addresses.npy"
uv run python -I pipeline/build_grid.py "$WORK/raw" "$WORK/work/osm" "$WORK/out/site/data" --region denmark
uv run python -I pipeline/build_world.py "$WORK/raw/world" "$WORK/out/site"
pipeline/basemap.sh "$WORK" "$WORK/out/site/data/basemap-region.geojson" "$WORK/raw/basemap/denmark_z12.pmtiles"
uv run python -I web/pack_site.py "$WORK/out/site" "$WORK/raw/basemap/denmark_z12.pmtiles" "$WORK/out/site/fonts" "$WORK/out/publish"
```

- `build_grid.py` writes one gzipped 8-bit raster per criterion, `meta.json`, the municipal
  outlines and the outline the basemap has to cover.
- The rasters are sampled onto a Web Mercator display grid, so the browser can draw them
  directly. The grid is 200 m for all of Denmark and 100 m for `--region oestjylland`.
- All of Denmark takes about 2.5 minutes and 3.7 GB of memory.
- `docs/data-sources.md` in the repository root describes each source and how it is fetched.

## Page

`web/index.template.html` is the map page: MapLibre GL JS with a Protomaps basemap,
plus the scoring engine, which uses one lookup table per criterion.

- `web/assemble.py` inlines the MapLibre stylesheet.
- `web/pack_site.py` packs the binary files into byte-container PNGs and the glyphs into
  JSON, because the artifact host only serves standard web types.

The basemap style comes from `@protomaps/basemaps` (flavour "light", Danish labels), with
font names rewritten to `noto-regular`, `noto-medium` and `noto-italic`.

## Sources

| Criterion | Source | Notes |
|---|---|---|
| Forest, lake/sea, beach, supermarket, station, roads, address points, municipalities | OpenStreetMap (Geofabrik) | ODbL. Forests and lakes count from 5 ha |
| Road noise | Miljøstyrelsen, strategic noise maps 2022 (Lden) | Every road in Copenhagen, Aarhus, Odense and Aalborg, and the major roads elsewhere (3 % of the land). Elsewhere estimated from road class and distance |
| Planning zone | Plandata.dk zone map | |
| Schools | STIL Institutionsregisteret | Folkeskoler, friskoler and private schools |
| Daycare | STIL Dagtilbudsregisteret | Active units |
| Wind turbines | Energistyrelsen, stamdataregister | Turbines in operation |
| Income tax, burglaries | Danmarks Statistik (PSKAT, STRAF22, FOLK1A) | Per municipality |
| Land and sea | OpenStreetMap municipalities and the national boundary | Municipalities follow the coastline; the national boundary includes the territorial sea |
| World map | Natural Earth 1:50m | Public domain; land, lakes, borders and names outside Denmark |
