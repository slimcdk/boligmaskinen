#!/bin/sh
# Stands in for go-pmtiles in the tests: pmtiles extract <url> <out> --region=<file> --maxzoom=<z>
mkdir -p "$TMPDIR"
echo "pmtiles $*" >> "$TMPDIR/../calls.log"
[ "$1" = "extract" ] || { echo "only extract" >&2; exit 2; }
printf 'tiles of %s from %s' "$(cat "${4#--region=}")" "$2" > "$3"
printf '\r  50%% |█████     |\r 100%% |██████████|\n' >&2
