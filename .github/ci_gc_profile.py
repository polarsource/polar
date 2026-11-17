import gc
import json
import os
import time
from pathlib import Path

import pytest

started = {}
wall_seconds = [0.0, 0.0, 0.0]
cpu_seconds = [0.0, 0.0, 0.0]
collections = [0, 0, 0]
initial_stats = []


def measure(phase: str, info: dict[str, int]) -> None:
    generation = info["generation"]
    if phase == "start":
        started[generation] = (time.perf_counter(), time.process_time())
    elif generation in started:
        wall, cpu = started.pop(generation)
        wall_seconds[generation] += time.perf_counter() - wall
        cpu_seconds[generation] += time.process_time() - cpu
        collections[generation] += 1


@pytest.hookimpl(tryfirst=True)
def pytest_load_initial_conftests() -> None:
    global initial_stats
    started.clear()
    wall_seconds[:] = [0.0, 0.0, 0.0]
    cpu_seconds[:] = [0.0, 0.0, 0.0]
    collections[:] = [0, 0, 0]
    initial_stats = gc.get_stats()
    if measure not in gc.callbacks:
        gc.callbacks.append(measure)


def pytest_unconfigure(config: pytest.Config) -> None:
    if measure in gc.callbacks:
        gc.callbacks.remove(measure)
    output = os.environ.get("POLAR_CI_POOL_OUTPUT")
    if output and Path(output).is_dir():
        worker = os.environ.get("PYTEST_XDIST_WORKER", "preload")
        result = {
            "pid": os.getpid(),
            "worker": worker,
            "root": str(config.rootpath),
            "wall_seconds_by_generation": wall_seconds,
            "cpu_seconds_by_generation": cpu_seconds,
            "collections_by_generation": collections,
            "initial_stats": initial_stats,
            "final_stats": gc.get_stats(),
            "frozen_objects": gc.get_freeze_count(),
            "enabled": gc.isenabled(),
            "thresholds": gc.get_threshold(),
        }
        (Path(output) / f"gc-{worker}-{os.getpid()}.json").write_text(json.dumps(result))
