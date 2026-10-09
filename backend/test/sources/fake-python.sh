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
  remote-zip)
    # remote-zip extract <url> <pattern> <out_dir>
    noise="$(cat "$TMPDIR/../noise.txt" 2>/dev/null || echo noise)"
    for ext in shp shx dbf prj; do printf '%s %s' "$noise" "$ext" > "$4/eu_2022_vej_4m.$ext"; done
    echo "Extracted 5 files"
    ;;
  world)
    out="$1"
    mkdir -p "$out"
    for name in land lakes boundaries countries places; do echo '{"type":"FeatureCollection","features":[]}' > "$out/$name.json"; done
    ;;
  *)
    echo "No such step: $step" >&2
    exit 2
    ;;
esac
