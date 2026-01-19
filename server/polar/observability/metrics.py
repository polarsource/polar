import gc
import os
import time

from polar.config import settings

# Setup multiprocess prometheus directory before importing prometheus_client
# This enables metrics to be shared across worker processes (main + forked health server)
prometheus_dir = settings.WORKER_PROMETHEUS_DIR
prometheus_dir.mkdir(parents=True, exist_ok=True)
os.environ["PROMETHEUS_MULTIPROC_DIR"] = str(prometheus_dir)

from prometheus_client import (  # noqa: E402 we need to set the environment variable before importing
    Counter,
    Histogram,
)

# Task metrics
TASK_EXECUTIONS = Counter(
    "polar_task_executions_total",
    "Total number of task executions",
    ["queue", "task_name", "status"],
)

TASK_DURATION = Histogram(
    "polar_task_duration_seconds",
    "Task execution duration in seconds",
    ["queue", "task_name"],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0),
)

TASK_RETRIES = Counter(
    "polar_task_retries_total",
    "Total number of task retries",
    ["queue", "task_name"],
)

# Debounce metrics
TASK_DEBOUNCED = Counter(
    "polar_task_debounced_total",
    "Total number of debounced tasks",
    ["queue", "task_name"],
)

TASK_DEBOUNCE_DELAY = Histogram(
    "polar_task_debounce_delay_seconds",
    "Debounce delay in seconds (time between first enqueue and execution)",
    ["queue", "task_name"],
    buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0, 1800.0, 3600.0),
)

# GC metrics
GC_COLLECTION_DURATION = Histogram(
    "polar_gc_collection_seconds",
    "Time spent in garbage collection",
    ["generation"],
    buckets=(0.001, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

_gc_start_time: float | None = None


def _gc_callback(phase: str, info: dict[str, int]) -> None:
    global _gc_start_time
    generation = str(info["generation"])

    if phase == "start":
        _gc_start_time = time.perf_counter()
    elif phase == "stop" and _gc_start_time is not None:
        duration = time.perf_counter() - _gc_start_time
        GC_COLLECTION_DURATION.labels(generation=generation).observe(duration)
        _gc_start_time = None


def register_gc_metrics() -> None:
    if _gc_callback not in gc.callbacks:
        gc.callbacks.append(_gc_callback)
