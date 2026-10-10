#!/bin/sh
# Stands in for the pipeline's Python in the tests: python -I -m boligmaskinen_pipeline <step> ...
# The step gets only a few variables, so this reads and writes next to its TMPDIR: every call is
# written to ../calls.log, and the noise map's content comes from ../noise.txt.
shift 3
step="$1"
shift
mkdir -p "$TMPDIR"
echo "$step $*" >> "$TMPDIR/../calls.log"
case "$step" in
  ok)
    echo "Working on it"
    echo "@progress 0.5"
    echo "A library warned about something" >&2
    echo "@progress 1"
    ;;
  fail)
    echo "Traceback (most recent call last):" >&2
    echo "  File \"grid.py\", line 1" >&2
    echo "Missing source files: zones" >&2
    exit 1
    ;;
  slow)
    echo "Started"
    exec sleep 30
    ;;
  hungry)
    # As the kernel's OOM killer would end it
    kill -9 $$
    ;;
  record)
    echo "start $(date +%s%N)" >> "$1"
    sleep 0.3
    echo "end $(date +%s%N)" >> "$1"
    ;;
  osm)
    mkdir -p "$2"
    printf 'layers of %s' "$(head -c 20 "$1")" > "$2/layers.gpkg"
    printf 'points' > "$2/addresses.npy"
    printf '{"addresses": 2615038, "road": 120000, "forest": 50000}' > "$2/counts.json"
    echo "@progress 1"
    ;;
  roads)
    # roads <pbf> <out>
    mkdir -p "$2"
    printf 'nodes of %s' "$(head -c 20 "$1")" > "$2/x.npy"
    printf '{"nodes": 7200839, "edges": 7784925, "carEdges": 8565564, "bikeEdges": 12979152, "walkEdges": 15345026}' > "$2/counts.json"
    echo "Built the network"
    ;;
  travel)
    # travel <roads> <pack> <lng> <lat> <out> --cache <dir>: a layer that names where it is to, or a failure for (0, 0)
    if [ "$3" = "0.00000" ]; then echo "There is no road near (0, 0)" >&2; exit 1; fi
    mkdir -p "$5" "$7"
    for mode in car bike walk; do printf '%s to %s,%s on %s' "$mode" "$3" "$4" "$(basename "$1")" > "$5/$mode.png"; done
    echo "car: 1,035,599 of 1,051,319 land cells within 254 minutes"
    ;;
  remote-zip)
    # remote-zip extract <url> <pattern> <out_dir>
    noise="$(cat "$TMPDIR/../noise.txt" 2>/dev/null || echo noise)"
    for map in eu_2022_vej_4m eu_2022_jernbane_4m eu_2022_lufthavn_4m eu_2022_virksomhed_by_4m; do
      for ext in shp shx dbf prj; do printf '%s %s' "$noise" "$ext" > "$4/$map.$ext"; done
    done
    echo "Extracted 16 files"
    ;;
  world)
    out="$1"
    mkdir -p "$out"
    for name in land lakes boundaries countries places; do echo '{"type":"FeatureCollection","features":[]}' > "$out/$name.json"; done
    ;;
  grid)
    # grid <inputs.json> <out> --region R --cell C: the counts come from ../counts.json when it is there
    inputs="$1"; out="$2"; region="$4"; cell="$6"
    counts="$(cat "$TMPDIR/../counts.json" 2>/dev/null || echo '{"addresses": 2615075, "homeCells": 459924, "schools": 1963}')"
    printf '{"region":{"id":"%s","name":"%s"},"width":2,"height":2,"cellMetres":%s,"gridMetres":%s,"files":{"forest":"forest.u8.gz"},"counts":%s}' \
      "$region" "$region" "$cell" "$cell" "$counts" > "$out/meta.json"
    printf 'grid of %s' "$(cat "$inputs" | tr -d '\n ')" | gzip > "$out/forest.u8.gz"
    echo '{"type":"FeatureCollection","features":[]}' > "$out/municipalities.json"
    printf '{"type":"FeatureCollection","features":[],"region":"%s"}' "$region" > "$out/basemap-region.geojson"
    echo "Built the grid of $region"
    ;;
  pack)
    # pack --grid G --basemap B --fonts F --sprites S --styles T --world W --out O --id ID
    while [ $# -gt 1 ]; do eval "arg_$(echo "$1" | tr -d '-')=\"\$2\""; shift 2; done
    mkdir -p "$arg_out/data" "$arg_out/basemap"
    sed "s/^{/{\"pack\":\"$arg_id\",\"basemap\":{\"parts\":1},/" "$arg_grid/meta.json" > "$arg_out/data/meta.json"
    cp "$arg_grid/forest.u8.gz" "$arg_grid/municipalities.json" "$arg_out/data/"
    cp "$arg_basemap" "$arg_out/basemap/part-0.png"
    mkdir -p "$arg_out/world" && cp -r "$arg_sprites" "$arg_out/" && cp "$arg_world"/*.json "$arg_out/world/"
    cp "$arg_styles"/*.json "$arg_out/"
    echo '{}' > "$arg_out/fonts.json"
    ;;
  *)
    echo "No such step: $step" >&2
    exit 2
    ;;
esac
