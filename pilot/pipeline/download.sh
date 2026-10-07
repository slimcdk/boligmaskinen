#!/usr/bin/env bash
# Download every source the pilot uses, for all of Denmark, into <work>/raw.
# Usage: pipeline/download.sh <work_dir>
# Requires: curl, python3, uv (for remote_zip.py), node/npm (for the basemap style).
set -euo pipefail

WORK="${1:?usage: download.sh <work_dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
RAW="$WORK/raw"
mkdir -p "$RAW"/{osm,plandata,ens,dst,stil,mst,basemap,world} "$WORK/tools"

# OpenStreetMap, Denmark (Geofabrik, ODbL), about 0.5 GB
curl -sSL -o "$RAW/osm/denmark-latest.osm.pbf" "https://download.geofabrik.de/europe/denmark-latest.osm.pbf"

# Miljøstyrelsen road noise 2022 (EU strategic noise maps, Lden). Only the 131 MB road layer is pulled
# out of the 2 GB archive with HTTP range requests.
uv run --project "$HERE/.." python -I "$HERE/remote_zip.py" extract \
  "https://files-miljoegis.mim.dk/noise2022/2022_noise_shp.zip" '^(.*/)?eu_2022_vej_4m\.(shp|shx|dbf|prj|cpg)$' "$RAW/mst/eu_vej_4m"

# Plandata.dk zone map (byzone and sommerhusområde polygons; everything else on land is landzone).
# The whole country is about 6,250 polygons (19 MB), so one request is enough.
curl -sS -o "$RAW/plandata/zonekort.geojson" \
  "https://geoserver.plandata.dk/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=pdk:theme_pdk_zonekort_v&outputFormat=application/json&srsName=EPSG:25832&count=20000"

# STIL: Institutionsregisteret (the JSON behind its public data-extract page) and Dagtilbudsregisteret
# (the page's own CSV export at "anvisningsenhed" level, which has coordinates)
curl -sS -H "Accept: application/json" -o "$RAW/stil/institutions.json" "https://institutionsregisteret.stil.dk/frontend-api/Institutions"
curl -sS -c "$RAW/stil/cookies.txt" -o "$RAW/stil/form.html" "https://dagtilbudsregister.stil.dk/Eksport.aspx"
python3 -I - "$RAW/stil/form.html" > "$RAW/stil/post.txt" <<'EOF'
import re, sys, urllib.parse
page = open(sys.argv[1], encoding="utf-8", errors="replace").read()
fields = {k: re.search(r'id="%s" value="([^"]*)"' % k, page).group(1) for k in ("__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION")}
fields.update({"__EVENTTARGET": "ctl00$ContentPlaceHolder1$LinkButtonAnv", "__EVENTARGUMENT": ""})
print(urllib.parse.urlencode(fields))
EOF
curl -sS -b "$RAW/stil/cookies.txt" -X POST --data @"$RAW/stil/post.txt" -H "Content-Type: application/x-www-form-urlencoded" \
  -o "$RAW/stil/dagtilbud_LinkButtonAnv.csv" "https://dagtilbudsregister.stil.dk/Eksport.aspx"

# Energistyrelsen: wind turbine master data ("Vinddata"). The media id changes with each monthly upload;
# find the current link on https://ens.dk/analyser-og-statistik/data-oversigt-over-energisektoren
curl -sSL -o "$RAW/ens/vinddata.xlsx" "https://ens.dk/media/8748/download"

# Danmarks Statistik: municipal tax 2026, home burglaries 2025, population (latest quarter).
# "*" returns every area (country, regions, municipalities); build_grid.py picks the municipalities.
K='"*"'
statbank() { curl -sS -X POST "https://api.statbank.dk/v1/data" -H "Content-Type: application/json" -d "$1" -o "$2"; }
statbank "{\"table\":\"PSKAT\",\"format\":\"JSONSTAT\",\"lang\":\"da\",\"variables\":[{\"code\":\"OMRÅDE\",\"values\":[$K]},{\"code\":\"SKATPCT\",\"values\":[\"KOM\",\"GRUND\"]},{\"code\":\"Tid\",\"values\":[\"2026\"]}]}" "$RAW/dst/pskat.json"
statbank "{\"table\":\"STRAF22\",\"format\":\"JSONSTAT\",\"lang\":\"da\",\"variables\":[{\"code\":\"OMRÅDE\",\"values\":[$K]},{\"code\":\"OVERTRÆD\",\"values\":[\"1320\"]},{\"code\":\"ANMSIGT\",\"values\":[\"ANM\"]},{\"code\":\"Tid\",\"values\":[\"2025\"]}]}" "$RAW/dst/straf.json"
statbank "{\"table\":\"FOLK1A\",\"format\":\"JSONSTAT\",\"lang\":\"da\",\"variables\":[{\"code\":\"OMRÅDE\",\"values\":[$K]},{\"code\":\"KØN\",\"values\":[\"TOT\"]},{\"code\":\"ALDER\",\"values\":[\"IALT\"]},{\"code\":\"CIVILSTAND\",\"values\":[\"TOT\"]},{\"code\":\"Tid\",\"values\":[\"(1)\"]}]}" "$RAW/dst/folk.json"

# Natural Earth 1:50m (public domain): the world map around Denmark
for f in physical/ne_50m_land physical/ne_50m_lakes cultural/ne_50m_admin_0_boundary_lines_land \
         cultural/ne_50m_admin_0_countries cultural/ne_50m_populated_places_simple; do
  curl -sSL -o "$RAW/world/$(basename "$f").zip" "https://naciscdn.org/naturalearth/50m/$f.zip"
done

# go-pmtiles, for pipeline/basemap.sh (the basemap is extracted after build_grid.py, which writes its outline)
curl -sSL -o "$WORK/tools/pmtiles.tgz" "https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles_1.31.2_Linux_x86_64.tar.gz"
tar -xzf "$WORK/tools/pmtiles.tgz" -C "$WORK/tools" pmtiles

# Basemap fonts, icons and style (Protomaps "light" flavour with Danish labels)
SITE="$WORK/out/site"
mkdir -p "$SITE/fonts" "$SITE/sprites" "$WORK/tools/style"
for pair in "Noto Sans Regular:noto-regular" "Noto Sans Medium:noto-medium" "Noto Sans Italic:noto-italic"; do
  name="${pair%%:*}"; id="${pair##*:}"; mkdir -p "$SITE/fonts/$id"
  for range in 0-255 256-511 8192-8447; do
    curl -sS -o "$SITE/fonts/$id/$range.pbf" "https://protomaps.github.io/basemaps-assets/fonts/${name// /%20}/$range.pbf"
  done
done
for f in light.json light.png light@2x.json light@2x.png; do
  curl -sS -o "$SITE/sprites/$f" "https://protomaps.github.io/basemaps-assets/sprites/v4/$f"
done
(cd "$WORK/tools/style" && npm init -y >/dev/null && npm install --silent @protomaps/basemaps@5 \
  && node --input-type=module -e 'import { layers, namedFlavor } from "@protomaps/basemaps"; console.log(JSON.stringify(layers("protomaps", namedFlavor("light"), { lang: "da" })))' > layers_light_da.json)
python3 -I - "$WORK/tools/style/layers_light_da.json" "$SITE/style-layers.json" <<'PY'
import json, sys
rename = {"Noto Sans Regular": "noto-regular", "Noto Sans Medium": "noto-medium", "Noto Sans Italic": "noto-italic"}
def walk(node):
    if isinstance(node, list):
        if node and all(isinstance(x, str) for x in node) and any(x.startswith("Noto Sans") for x in node):
            return [rename[x] for x in node if x in rename] or ["noto-regular"]
        return [walk(x) for x in node]
    if isinstance(node, dict):
        return {k: walk(v) for k, v in node.items()}
    return node
json.dump(walk(json.load(open(sys.argv[1]))), open(sys.argv[2], "w"), separators=(",", ":"))
PY

echo "Downloaded into $RAW"
