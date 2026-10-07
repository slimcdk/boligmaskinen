#!/usr/bin/env bash
# Extract the Protomaps basemap for the area build_grid.py outlined (basemap-region.geojson).
# Only the tiles that touch the outline are fetched, with HTTP range requests on the daily planet build.
# Usage: pipeline/basemap.sh <work_dir> <basemap-region.geojson> <out.pmtiles> [maxzoom]
set -euo pipefail

WORK="${1:?usage: basemap.sh <work_dir> <region.geojson> <out.pmtiles> [maxzoom]}"
REGION="${2:?region outline}"
OUT="${3:?output file}"
MAXZOOM="${4:-12}"  # Denmark up to zoom 12 is about 75 MB; zoom 13 doubles it

BUILD="$(curl -sS https://build-metadata.protomaps.dev/builds.json | python3 -I -c 'import json,sys; print(json.load(sys.stdin)[-1]["key"])')"
"$WORK/tools/pmtiles" extract "https://build.protomaps.com/$BUILD" "$OUT" --region="$REGION" --maxzoom="$MAXZOOM"
echo "Extracted $OUT from build $BUILD"
