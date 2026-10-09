# Boligmaskinen's data pipeline

The Python steps that turn the open data into the data pack the map loads. The app's data jobs
run them: the jobs fetch the sources, and each step is one command,
`python -m boligmaskinen_pipeline <step>`. The app image has Python and these steps built in.

| Step | Reads | Writes |
|---|---|---|
| `osm` | The Geofabrik extract of Denmark | `layers.gpkg` with a layer per theme (forests, water, roads, municipalities …) and `addresses.npy` |
| `grid` | `inputs.json`, naming the OSM extract and every other source | A gzipped 8-bit raster per layer, `meta.json`, the municipal outlines, the outline the basemap has to cover, and detail tiles where the display grid is coarser than the grid |
| `world` | Natural Earth's five 1:50m zips | The world map outside Denmark: land, lakes, borders and names |
| `pack` | The grid, the basemap, fonts, sprites, styles and the world map | The data pack |
| `remote-zip` | A ZIP file on a web server | The members asked for, fetched with HTTP range requests |

The grid is built in EPSG:25832, aligned to Det Danske Kvadratnet, with 100 m cells unless
`--cell` says otherwise. It is then sampled onto a Web Mercator display grid, which the browser
draws directly: 200 m for all of Denmark and 100 m for a smaller region, and never finer than
the grid. `--region` takes `denmark`, `oestjylland`, `aarhus` or municipality codes such as
`751,706`.

**Detail tiles.** Where the display grid is coarser than the grid (all of Denmark: 200 m against
100 m), the grid step also cuts the region into tiles of 256 × 256 cells at the grid's own cell
size. They are aligned with the display grid, and each holds every layer, one after the other.
Only the tiles with land are written: 121 for Denmark, 15 MB. The map loads the ones around the
view from zoom 10, so zooming into a town shows 100 m cells (`meta.json` → `tiles`).

All of Denmark takes a little over a minute and 3.8 GB of memory. `--region aarhus` builds only
Aarhus Kommune in 15 seconds; it is the frontend's test data pack (see below).
`docs/data-sources.md` in the repository root describes every source and how it is fetched.

## Running the steps by hand

```sh
uv sync
scripts/download.sh "$WORK"        # every source into $WORK/raw, and $WORK/inputs.json
uv run python -I -m boligmaskinen_pipeline osm "$WORK/raw/osm/denmark-latest.osm.pbf" "$WORK/work/osm"
uv run python -I -m boligmaskinen_pipeline grid "$WORK/inputs.json" "$WORK/work/grid" --region denmark
uv run python -I -m boligmaskinen_pipeline world "$WORK/work/world" "$WORK"/raw/world/*.zip
scripts/basemap.sh "$WORK" "$WORK/work/grid/basemap-region.geojson" "$WORK/raw/basemap/denmark_z12.pmtiles"
uv run python -I -m boligmaskinen_pipeline pack --grid "$WORK/work/grid" \
    --basemap "$WORK/raw/basemap/denmark_z12.pmtiles" --fonts "$WORK/out/site/fonts" \
    --sprites "$WORK/out/site/sprites" --styles "$WORK/out/site" --world "$WORK/work/world" --out "$WORK/out/pack"
```

`uv run pytest` runs the tests. They build every step from small, made-up sources in seconds.

## Test data pack

The frontend's end-to-end tests use a small data pack for Aarhus Kommune, committed in
`frontend/e2e/data-pack` (about 5 MB). After changes to the pipeline or the pack format, rebuild
it from the national build's downloads, OSM extract, styles, sprites and world map:

```sh
uv run python -I -m boligmaskinen_pipeline grid "$WORK/inputs.json" "$WORK/work/test-grid" --region aarhus
"$WORK/tools/pmtiles" extract "$WORK/raw/basemap/denmark_z12.pmtiles" "$WORK/raw/basemap/aarhus_z11.pmtiles" \
    --region="$WORK/work/test-grid/basemap-region.geojson" --maxzoom=11
rm -rf ../frontend/e2e/data-pack
uv run python -I -m boligmaskinen_pipeline pack --grid "$WORK/work/test-grid" \
    --basemap "$WORK/raw/basemap/aarhus_z11.pmtiles" --fonts "$WORK/out/site/fonts" \
    --sprites "$WORK/out/site/sprites" --styles "$WORK/out/site" --world "$WORK/work/world" --out ../frontend/e2e/data-pack
```

## The data pack

- **Byte containers.** The data layers and the basemap are packed into "byte container" PNGs:
  8-bit grayscale images whose rows hold the bytes. Any web server serves and compresses them,
  and the frontend reads the bytes back exactly (`frontend/src/app/data/byte-container.ts`).
- **The basemap in parts.** The basemap is split into 5 MB parts that are fetched only when the
  map needs a tile in them, so the first map appears sooner.
- **Fonts.** The glyphs are one JSON file of base64 strings.
- **Styles.** The basemap styles come from `@protomaps/basemaps` (flavours "light" and "dark",
  Danish labels), with the font names rewritten to `noto-regular`, `noto-medium` and
  `noto-italic`.
  - The app uses `style-layers.json` and `sprites/light` in light mode, and
    `style-layers-dark.json` and `sprites/dark` in dark mode.
  - The two flavours have the same layers, so the app switches by changing colours only.

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
