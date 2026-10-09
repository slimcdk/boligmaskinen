"""What a step tells the job that runs it, on stdout.

The backend's job runner (backend/src/pipeline/python.ts) shows every line in the job's log,
except the lines that start with "@progress ", which move its progress bar (0–1).
"""

import sys


def log(text: str) -> None:
    print(text, flush=True)


def progress(fraction: float) -> None:
    print(f"@progress {max(0.0, min(1.0, fraction)):.3f}", flush=True)


def warn(text: str) -> None:
    print(text, file=sys.stderr, flush=True)
