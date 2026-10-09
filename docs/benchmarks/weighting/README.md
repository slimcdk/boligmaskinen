# Weighting benchmark

The same weighting in five ways:
- **Blocks:** 3 preferences (forest, road noise with 5 % missing data, school) and 1
  zone requirement.
- **Data:** 4,251,411 cells, all Danish land at 100 m.
- **Output:** the importance-weighted score and a histogram.
- **Machine:** one thread, on the development machine (8 cores).

| Implementation | Time | Relative |
|---|---:|---:|
| Node 24, the prototype's block engine (formulas run as closures) | 2,284 ms | 29× |
| Node 24, one generated loop (what compiling the formulas would give) | 100 ms | 1.3× |
| Python 3.12 + NumPy 2.5, vectorised | 144 ms | 1.8× |
| Go 1.27, loop | 109 ms | 1.4× |
| Rust 1.97, loop (`-C opt-level=3 -C target-cpu=native`) | 78 ms | 1.0× |

Run them again with:

```sh
npx esbuild ../../../packages/engine/src/blocks.ts --bundle --format=esm --platform=node --outfile=blocks.mjs
node bench.mjs                       # Node 24
uv run --project ../../../pipeline python -I bench_numpy.py
go run bench.go
rustc -C opt-level=3 -C target-cpu=native -o bench_rs bench.rs && ./bench_rs
```
