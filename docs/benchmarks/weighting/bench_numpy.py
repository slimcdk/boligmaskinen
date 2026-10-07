"""Weighting benchmark in NumPy: same blocks as bench.mjs, vectorised over all cells."""
import time
import numpy as np

N = 4_251_411
rng = np.random.default_rng(42)
forest = (rng.random(N) * 8000).astype(np.float32)
noise = (40 + rng.random(N) * 35).astype(np.float32)
noise[rng.random(N) < 0.05] = np.nan
school = (rng.random(N) * 10000).astype(np.float32)
zone = (1 + np.floor(rng.random(N) * 3)).astype(np.float32)


def ramp(x, full, zero):
    return np.clip((zero - x) / np.float32(zero - full), 0, 1)


def run():
    ok = (zone == 1) | (zone == 2)
    quiet = ramp(noise, 45, 65)
    has_noise = ~np.isnan(quiet)
    total = 4 * ramp(forest, 300, 3000) + np.where(has_noise, 4 * quiet, 0) + 2 * ramp(school, 1000, 5000)
    weight = np.where(has_noise, 10, 6).astype(np.float32)
    score = np.where(ok, total / weight * 100, -1)
    hist = np.bincount(np.rint(score[ok]).astype(np.int64), minlength=101)
    return hist


run()
times = []
for _ in range(7):
    t = time.perf_counter()
    run()
    times.append((time.perf_counter() - t) * 1000)
print(f"{'Python 3.12 + NumPy 2.5: vectorised':44} {sorted(times)[3]:7.1f} ms")
