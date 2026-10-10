"""Memory a step has freed, given back to the system.

glibc keeps memory that Python and the libraries free, to hand it out again in the process. In a
container with a memory limit it still counts as used, so the steps give it back between their
parts (#69).
"""

import ctypes
import gc


def _malloc_trim():
    try:
        return ctypes.CDLL("libc.so.6").malloc_trim
    except (OSError, AttributeError):  # not glibc
        return None


MALLOC_TRIM = _malloc_trim()


def release() -> None:
    """Free what is no longer used, and give the memory back to the system."""
    gc.collect()  # data frames in reference cycles wait for the collector
    if MALLOC_TRIM is not None:
        MALLOC_TRIM(0)
