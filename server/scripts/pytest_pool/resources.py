import asyncio
import errno
import gc
import os
import stat
from dataclasses import dataclass

import psutil


@dataclass(frozen=True)
class Resources:
    threads: int
    sockets: frozenset[int]
    loops: tuple[str, ...]


def inspect_resources() -> Resources:
    directory = "/proc/self/fd" if os.path.isdir("/proc/self/fd") else "/dev/fd"
    sockets = set()
    for name in os.listdir(directory):
        try:
            descriptor = int(name)
            if stat.S_ISSOCK(os.fstat(descriptor).st_mode):
                sockets.add(descriptor)
        except OSError as error:
            if error.errno != errno.EBADF:
                raise
    loops = tuple(
        type(value).__name__
        for value in gc.get_objects()
        if isinstance(value, asyncio.AbstractEventLoop) and not value.is_closed()
    )
    return Resources(
        psutil.Process().num_threads(),
        frozenset(sockets),
        loops,
    )


def require_clean(before: Resources, after: Resources) -> None:
    if before.threads != 1 or before.loops:
        raise RuntimeError(f"Unsafe preload baseline: {before}")
    if after.threads != 1 or after.loops or after.sockets - before.sockets:
        raise RuntimeError(
            f"Resources retained after collection: before={before}, after={after}"
        )
